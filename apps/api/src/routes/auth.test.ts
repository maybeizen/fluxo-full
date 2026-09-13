import { generateKey } from "@fluxo/crypto";
import type { FluxoLogger } from "@fluxo/logger";
import { AuthTokenType, UserRole, type LoginResponse, type PublicUser } from "@fluxo/types";
import { Hono } from "hono";
import * as OTPAuth from "otpauth";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { generateTotpSecret, sealMfaSecret } from "../auth/mfa.js";
import { requireSession } from "../auth/require-session.js";
import { createMemoryAuth } from "../auth/stores/memory.js";
import { createAuthToken, hashAuthToken } from "../auth/tokens.js";

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

async function register(
  app: ReturnType<typeof createApp>,
  overrides?: Partial<{
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }>,
) {
  return app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      email: "ada@example.com",
      password: "password12",
      firstName: "Ada",
      lastName: "Lovelace",
      ...overrides,
    }),
  });
}

async function login(
  app: ReturnType<typeof createApp>,
  overrides?: Partial<{ username: string; password: string; rememberMe: boolean }>,
) {
  return app.request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      password: "password12",
      rememberMe: true,
      ...overrides,
    }),
  });
}

describe("auth api", () => {
  it("registers, logs in with a session cookie, and returns /auth/me", async () => {
    const { app } = setup();
    const registered = await register(app);
    expect(registered.status).toBe(201);
    const created = (await registered.json()) as { user: PublicUser };
    expect(created.user.username).toBe("ada");
    expect(created.user.role).toBe(UserRole.Admin);
    expect(created.user.emailVerified).toBe(true);

    const loggedIn = await login(app);
    expect(loggedIn.status).toBe(200);
    const loginBody = (await loggedIn.json()) as LoginResponse;
    expect("user" in loginBody).toBe(true);
    const cookie = sessionCookie(loggedIn);
    expect(cookie.startsWith("fluxo.sid=")).toBe(true);
    expect(loggedIn.headers.getSetCookie().join(";")).toMatch(/HttpOnly/i);
    expect(loggedIn.headers.getSetCookie().join(";")).toMatch(/SameSite=Lax/i);

    const me = await app.request("/auth/me", { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: PublicUser };
    expect(body.user.email).toBe("ada@example.com");
    expect(body.user.mfaEnabled).toBe(false);
    expect(body.user.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects unverified accounts", async () => {
    const { app } = setup({ nodeEnv: "production" });
    expect((await register(app)).status).toBe(201);

    const loggedIn = await login(app);
    expect(loggedIn.status).toBe(403);
    const body = (await loggedIn.json()) as { code: string };
    expect(body.code).toBe("email_not_verified");
  });

  it("blocks /auth/me while MFA is pending and unlocks after TOTP", async () => {
    const appKey = generateKey();
    const { app, users } = setup({ appKey });
    await register(app);

    const user = await users.findByUsername("ada");
    if (!user) {
      throw new Error("expected registered user");
    }

    const secret = generateTotpSecret();
    await users.updateMfa(user.id, {
      mfaEnabled: true,
      mfaSecret: sealMfaSecret(secret, appKey),
    });

    const loggedIn = await login(app);
    expect(loggedIn.status).toBe(200);
    const loginBody = (await loggedIn.json()) as LoginResponse;
    expect(loginBody).toEqual({ requiresMfa: true });
    const cookie = sessionCookie(loggedIn);

    const pending = await app.request("/auth/me", { headers: { cookie } });
    expect(pending.status).toBe(401);
    expect(await pending.json()).toEqual({ code: "mfa_required" });

    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
    const verified = await app.request("/auth/mfa", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ code: totp.generate() }),
    });
    expect(verified.status).toBe(200);

    const me = await app.request("/auth/me", { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: PublicUser };
    expect(body.user.mfaEnabled).toBe(true);
  });

  it("clears the session cookie on logout", async () => {
    const { app } = setup();
    await register(app);
    const loggedIn = await login(app);
    const cookie = sessionCookie(loggedIn);

    const logout = await app.request("/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.getSetCookie().join(";")).toMatch(/fluxo\.sid=/);

    const me = await app.request("/auth/me", { headers: { cookie } });
    expect(me.status).toBe(401);
  });

  it("confirms email and resets passwords through hashed tokens", async () => {
    const { app, users, tokens } = setup({ nodeEnv: "production" });
    await register(app);
    const user = await users.findByUsername("ada");
    if (!user) {
      throw new Error("expected registered user");
    }

    const confirmToken = createAuthToken();
    await tokens.create({
      tokenHash: hashAuthToken(confirmToken),
      userId: user.id,
      type: AuthTokenType.EmailConfirm,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const confirmed = await app.request("/auth/confirm-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: confirmToken }),
    });
    expect(confirmed.status).toBe(200);
    expect((await login(app)).status).toBe(200);

    const resetToken = createAuthToken();
    await tokens.create({
      tokenHash: hashAuthToken(resetToken),
      userId: user.id,
      type: AuthTokenType.PasswordReset,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const reset = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: "newpass123" }),
    });
    expect(reset.status).toBe(200);

    const oldPassword = await login(app);
    expect(oldPassword.status).toBe(401);
    const nextLogin = await login(app, { password: "newpass123" });
    expect(nextLogin.status).toBe(200);
  });

  it("always accepts forgot-password without revealing accounts", async () => {
    const { app } = setup();
    const missing = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "missing@example.com" }),
    });
    expect(missing.status).toBe(200);
    expect(await missing.json()).toEqual({ ok: true });
  });

  it("guards later /_app routes with requireSession", async () => {
    const { app, sessions, users } = setup();
    await register(app);
    const loggedIn = await login(app);
    const cookie = sessionCookie(loggedIn);

    const guarded = new Hono();
    guarded.use("/_app/*", requireSession({ sessions, users }));
    guarded.get("/_app/ping", (c) => c.json({ ok: true }));

    const denied = await guarded.request("/_app/ping");
    expect(denied.status).toBe(401);

    const allowed = await guarded.request("/_app/ping", { headers: { cookie } });
    expect(allowed.status).toBe(200);
  });
});
