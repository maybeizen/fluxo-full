import { createHash } from "node:crypto";
import { generateKey } from "@fluxo/crypto";
import type { FluxoLogger } from "@fluxo/logger";
import type { PublicUser } from "@fluxo/types";
import * as OTPAuth from "otpauth";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { createMemoryAuth } from "../auth/stores/memory.js";
import type { WebAuthnService } from "../auth/webauthn.js";

function mockLogger(): FluxoLogger {
  const logger: FluxoLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function setup(options?: Parameters<typeof createMemoryAuth>[0]) {
  const auth = createMemoryAuth(options);
  const app = createApp({
    logger: mockLogger(),
    redis: { ping: async () => "PONG" },
    postgres: { ping: async () => undefined },
    corsOrigin: "http://localhost:5173",
    auth,
  });
  return { app, ...auth };
}

function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((value) => value.startsWith("fluxo.sid="));
  if (!session) {
    throw new Error("missing fluxo.sid cookie");
  }
  return session.split(";", 1)[0] ?? session;
}

async function register(app: ReturnType<typeof createApp>) {
  return app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      email: "ada@example.com",
      password: "password12",
      firstName: "Ada",
      lastName: "Lovelace",
    }),
  });
}

async function login(app: ReturnType<typeof createApp>, cookie?: string) {
  return app.request("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({
      username: "ada",
      password: "password12",
      rememberMe: true,
    }),
  });
}

async function signedIn(options?: Parameters<typeof createMemoryAuth>[0]) {
  const ctx = setup(options);
  await register(ctx.app);
  const loggedIn = await login(ctx.app);
  return { ...ctx, cookie: sessionCookie(loggedIn) };
}

async function enableMfa(app: ReturnType<typeof createApp>, cookie: string) {
  const setupRes = await app.request("/auth/mfa/setup", {
    method: "POST",
    headers: { cookie },
  });
  const setupBody = (await setupRes.json()) as { secret: string; otpauthUrl: string };
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(setupBody.secret) });
  const enableRes = await app.request("/auth/mfa/enable", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: totp.generate() }),
  });
  return { setupRes, setupBody, totp, enableRes };
}

describe("profile and security api", () => {
  it("sets up and enables TOTP MFA with one-time backup codes", async () => {
    const appKey = generateKey();
    const { app, cookie } = await signedIn({ appKey });
    const { setupRes, setupBody, enableRes } = await enableMfa(app, cookie);

    expect(setupRes.status).toBe(200);
    expect(setupBody.secret.length).toBeGreaterThan(8);
    expect(setupBody.otpauthUrl.startsWith("otpauth://totp/")).toBe(true);
    expect(setupBody.otpauthUrl).toContain("secret=");

    expect(enableRes.status).toBe(200);
    const enabled = (await enableRes.json()) as {
      user: PublicUser;
      backupCodes: string[];
      suggestDownload: boolean;
    };
    expect(enabled.user.mfaEnabled).toBe(true);
    expect(enabled.suggestDownload).toBe(true);
    expect(enabled.backupCodes).toHaveLength(10);
    expect(new Set(enabled.backupCodes).size).toBe(10);

    const me = await app.request("/auth/me", { headers: { cookie } });
    const body = (await me.json()) as { user: PublicUser };
    expect(body.user.mfaEnabled).toBe(true);
    expect(body.user.hasPasskey).toBe(false);

    await app.request("/auth/logout", { method: "POST", headers: { cookie } });
    const loggedIn = await login(app);
    const pending = sessionCookie(loggedIn);
    const backup = await app.request("/auth/mfa", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: pending },
      body: JSON.stringify({ code: enabled.backupCodes[0] }),
    });
    expect(backup.status).toBe(200);
  });

  it("requires a single-use step-up challenge before email and password changes", async () => {
    const appKey = generateKey();
    const { app, cookie } = await signedIn({ appKey });
    const { totp } = await enableMfa(app, cookie);

    const deniedEmail = await app.request("/auth/email/change", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email: "ada2@example.com" }),
    });
    expect(deniedEmail.status).toBe(403);
    expect(await deniedEmail.json()).toEqual({ code: "step_up_required" });

    const deniedPassword = await app.request("/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "password12", newPassword: "password99" }),
    });
    expect(deniedPassword.status).toBe(403);
    expect(await deniedPassword.json()).toEqual({ code: "step_up_required" });

    const stepped = await app.request("/auth/step-up/totp", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ code: totp.generate() }),
    });
    expect(stepped.status).toBe(200);
    const challenge = (await stepped.json()) as { challengeId: string; expiresAt: string };
    expect(challenge.challengeId.length).toBeGreaterThan(10);
    expect(Number.isNaN(Date.parse(challenge.expiresAt))).toBe(false);
    expect(Date.parse(challenge.expiresAt)).toBeGreaterThan(Date.now());

    const changed = await app.request("/auth/email/change", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email: "ada2@example.com", challengeId: challenge.challengeId }),
    });
    expect(changed.status).toBe(200);
    const changeBody = (await changed.json()) as { ok: true; token: string };
    expect(changeBody.ok).toBe(true);
    expect(changeBody.token.length).toBeGreaterThan(10);

    const reused = await app.request("/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        currentPassword: "password12",
        newPassword: "password99",
        challengeId: challenge.challengeId,
      }),
    });
    expect(reused.status).toBe(403);
    expect(await reused.json()).toEqual({ code: "step_up_invalid" });

    const confirmed = await app.request("/auth/confirm-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: changeBody.token }),
    });
    expect(confirmed.status).toBe(200);

    const me = await app.request("/auth/me", { headers: { cookie } });
    const meBody = (await me.json()) as { user: PublicUser };
    expect(meBody.user.email).toBe("ada2@example.com");
    expect(meBody.user.emailVerified).toBe(true);

    const nextStep = await app.request("/auth/step-up/totp", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ code: totp.generate() }),
    });
    const nextChallenge = (await nextStep.json()) as { challengeId: string };
    const password = await app.request("/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        currentPassword: "password12",
        newPassword: "password99",
        challengeId: nextChallenge.challengeId,
      }),
    });
    expect(password.status).toBe(200);
  });

  it("lists sessions and revokes others while keeping the current session", async () => {
    const { app, cookie } = await signedIn();
    const second = await login(app);
    const secondCookie = sessionCookie(second);

    const listed = await app.request("/auth/sessions", { headers: { cookie } });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as {
      sessions: Array<{ id: string; current: boolean; createdAt: string; lastSeenAt: string }>;
    };
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions.filter((row) => row.current)).toHaveLength(1);
    const other = body.sessions.find((row) => !row.current);
    expect(other).toBeDefined();

    const revoked = await app.request(`/auth/sessions/${other?.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(revoked.status).toBe(200);
    expect((await app.request("/auth/me", { headers: { cookie: secondCookie } })).status).toBe(401);

    const third = await login(app);
    const thirdCookie = sessionCookie(third);
    const cleared = await app.request("/auth/sessions", {
      method: "DELETE",
      headers: { cookie },
    });
    expect(cleared.status).toBe(200);
    expect((await app.request("/auth/me", { headers: { cookie: thirdCookie } })).status).toBe(401);

    const remaining = await app.request("/auth/sessions", { headers: { cookie } });
    const remainingBody = (await remaining.json()) as { sessions: Array<{ current: boolean }> };
    expect(remainingBody.sessions).toHaveLength(1);
    expect(remainingBody.sessions[0]?.current).toBe(true);
  });

  it("sets a gravatar avatar url from the current email", async () => {
    const { app, cookie } = await signedIn();
    const response = await app.request("/auth/avatar/gravatar", {
      method: "POST",
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: PublicUser };
    const hash = createHash("md5").update("ada@example.com").digest("hex");
    expect(body.user.avatarSource).toBe("gravatar");
    expect(body.user.avatarUrl).toBe(`https://www.gravatar.com/avatar/${hash}`);
  });

  it("registers and authenticates a passkey with a mocked verifier", async () => {
    const webauthn: WebAuthnService = {
      registrationOptions: vi.fn(async () => ({
        challenge: "reg-challenge",
        rp: { name: "Fluxo", id: "localhost" },
        user: { id: "dXNlcg", name: "ada", displayName: "Ada Lovelace" },
        pubKeyCredParams: [],
      })),
      verifyRegistration: vi.fn(async () => ({
        verified: true,
        credential: {
          id: "cred-1",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
        },
      })),
      authenticationOptions: vi.fn(async () => ({
        challenge: "auth-challenge",
        allowCredentials: [{ id: "cred-1" }],
      })),
      verifyAuthentication: vi.fn(async () => ({ verified: true, newCounter: 2 })),
    };

    const { app, cookie } = await signedIn({ webauthn });
    const optionsRes = await app.request("/auth/passkeys/register/options", {
      method: "POST",
      headers: { cookie },
    });
    expect(optionsRes.status).toBe(200);

    const verified = await app.request("/auth/passkeys/register/verify", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        id: "cred-1",
        rawId: "cred-1",
        type: "public-key",
        response: { clientDataJSON: "e30", attestationObject: "e30" },
        name: "Laptop",
      }),
    });
    expect(verified.status).toBe(200);
    const created = (await verified.json()) as { passkey: { id: string; name: string } };
    expect(created.passkey).toEqual(expect.objectContaining({ id: "cred-1", name: "Laptop" }));

    const listed = await app.request("/auth/passkeys", { headers: { cookie } });
    const listBody = (await listed.json()) as { passkeys: Array<{ id: string }> };
    expect(listBody.passkeys).toHaveLength(1);

    await app.request("/auth/logout", { method: "POST", headers: { cookie } });
    const loginOptions = await app.request("/auth/passkeys/login/options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "ada" }),
    });
    expect(loginOptions.status).toBe(200);

    const loginVerify = await app.request("/auth/passkeys/login/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "cred-1",
        rawId: "cred-1",
        type: "public-key",
        response: {
          clientDataJSON: Buffer.from(
            JSON.stringify({ challenge: "auth-challenge", origin: "http://localhost:5173", type: "webauthn.get" }),
          ).toString("base64url"),
          authenticatorData: "e30",
          signature: "e30",
        },
      }),
    });
    expect(loginVerify.status).toBe(200);
    const loginBody = (await loginVerify.json()) as { user: PublicUser };
    expect(loginBody.user.username).toBe("ada");
    expect(loginBody.user.hasPasskey).toBe(true);
  });
});
