import { getCookie } from "hono/cookie";
import type { Hono } from "hono";
import type { AppBindings } from "../../app-bindings.js";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { SESSION_COOKIE_NAME } from "../../auth/cookie.js";
import { issueSession } from "../../auth/issue-session.js";
import { passkeyLoginOptionsBodySchema } from "../../auth/schemas.js";
import {
  decodePublicKey,
  encodePublicKey,
  parseTransports,
  relyingParty,
  serializeTransports,
  type WebAuthnCredentialInput,
} from "../../auth/webauthn.js";
import type { AuthRouteOptions } from "./shared.js";
import { assertStepUp, toPublicAccount, WEBAUTHN_CHALLENGE_TTL_SECONDS } from "./shared.js";
import {
  emailVerificationRequired,
  loginAllowed,
  rejectCaptcha,
} from "../../settings/guards.js";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isRegistrationResponse(value: unknown): value is RegistrationResponseJSON & {
  name?: string;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.response === "object";
}

function isAuthenticationResponse(value: unknown): value is AuthenticationResponseJSON {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.response === "object";
}

function publicPasskey(record: {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}) {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    lastUsedAt: record.lastUsedAt ? record.lastUsedAt.toISOString() : null,
  };
}

function challengeFromResponse(body: AuthenticationResponseJSON): string | null {
  try {
    const json = Buffer.from(body.response.clientDataJSON, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const challenge = (parsed as Record<string, unknown>).challenge;
    return typeof challenge === "string" ? challenge : null;
  } catch {
    return null;
  }
}

export function registerPasskeyRoutes(routes: Hono<AppBindings>, options: AuthRouteOptions): void {
  routes.post("/passkeys/register/options", async (c) => {
    const account = c.get("account");
    const existing = await options.passkeys.listByUserId(account.id);
    const rp = relyingParty(options.config);
    const webauthnOptions = await options.webauthn.registrationOptions({
      rpName: rp.rpName,
      rpID: rp.rpID,
      userID: new TextEncoder().encode(account.id),
      userName: account.username,
      userDisplayName: `${account.firstName} ${account.lastName}`.trim(),
      excludeCredentials: existing.map((credential) => ({
        id: credential.id,
        transports: parseTransports(credential.transports),
      })),
    });
    await options.webauthnChallenges.set(
      `register:${account.id}`,
      webauthnOptions.challenge,
      WEBAUTHN_CHALLENGE_TTL_SECONDS,
    );
    return c.json(webauthnOptions);
  });

  routes.post("/passkeys/register/verify", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRegistrationResponse(body)) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const account = c.get("account");
    const expectedChallenge = await options.webauthnChallenges.consume(`register:${account.id}`);
    if (!expectedChallenge) {
      return c.json({ error: "Invalid or expired challenge" }, 400);
    }

    const rp = relyingParty(options.config);
    let credential: WebAuthnCredentialInput | undefined;
    try {
      const result = await options.webauthn.verifyRegistration({
        response: body,
        expectedChallenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
      });
      if (!result.verified || !result.credential) {
        return c.json({ error: "Verification failed" }, 401);
      }
      credential = result.credential;
    } catch {
      return c.json({ error: "Verification failed" }, 401);
    }

    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 64)
        : "Passkey";
    const created = await options.passkeys.create({
      id: credential.id,
      userId: account.id,
      name,
      publicKey: encodePublicKey(credential.publicKey),
      counter: credential.counter,
      transports: serializeTransports(credential.transports),
    });
    return c.json({ passkey: publicPasskey(created) });
  });

  routes.get("/passkeys", async (c) => {
    const account = c.get("account");
    const records = await options.passkeys.listByUserId(account.id);
    return c.json({ passkeys: records.map(publicPasskey) });
  });

  routes.delete("/passkeys/:id", async (c) => {
    const account = c.get("account");
    const challengeId = c.req.query("challengeId");
    const blocked = await assertStepUp(c, options, account, challengeId);
    if (blocked) {
      return blocked;
    }

    const deleted = await options.passkeys.delete(c.req.param("id"), account.id);
    if (!deleted) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ ok: true });
  });
}

export function registerPasskeyLoginRoutes(routes: Hono<AppBindings>, options: AuthRouteOptions): void {
  routes.post("/passkeys/login/options", async (c) => {
    const parsed = passkeyLoginOptionsBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const captcha = await rejectCaptcha(c, options, parsed.data.captchaToken);
    if (captcha) {
      return captcha;
    }

    const rp = relyingParty(options.config);
    const username = parsed.data.username;
    const user = username ? await options.users.findByUsername(username) : null;
    const credentials = user ? await options.passkeys.listByUserId(user.id) : [];
    const webauthnOptions = await options.webauthn.authenticationOptions({
      rpID: rp.rpID,
      allowCredentials: user
        ? credentials.map((credential) => ({
            id: credential.id,
            transports: parseTransports(credential.transports),
          }))
        : undefined,
    });
    const key = user ? `login:${user.id}` : `login:anon:${webauthnOptions.challenge}`;
    await options.webauthnChallenges.set(key, webauthnOptions.challenge, WEBAUTHN_CHALLENGE_TTL_SECONDS);
    return c.json(webauthnOptions);
  });

  routes.post("/passkeys/login/verify", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isAuthenticationResponse(body)) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const credential = await options.passkeys.findById(body.id);
    if (!credential) {
      return c.json({ error: "Unknown passkey" }, 401);
    }

    const user = await options.users.findById(credential.userId);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const settings = options.settings.current();
    if (!loginAllowed(user, settings.authDisableLogin)) {
      return c.json({ code: "login_disabled" }, 403);
    }
    if (emailVerificationRequired(user, settings.authDisableEmailVerificationRequirement)) {
      return c.json({ code: "email_not_verified" }, 403);
    }

    const expectedChallenge =
      (await options.webauthnChallenges.consume(`login:${user.id}`)) ??
      (await options.webauthnChallenges.consume(`login:anon:${challengeFromResponse(body) ?? ""}`));
    if (!expectedChallenge) {
      return c.json({ error: "Invalid or expired challenge" }, 400);
    }

    const rp = relyingParty(options.config);
    let newCounter: number | undefined;
    try {
      const result = await options.webauthn.verifyAuthentication({
        response: body,
        expectedChallenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
        credential: {
          id: credential.id,
          publicKey: decodePublicKey(credential.publicKey),
          counter: credential.counter,
          transports: parseTransports(credential.transports),
        },
      });
      if (!result.verified) {
        return c.json({ error: "Verification failed" }, 401);
      }
      newCounter = result.newCounter;
    } catch {
      return c.json({ error: "Verification failed" }, 401);
    }

    await options.passkeys.touch(credential.id, newCounter ?? credential.counter);
    const current = await options.sessions.resolve(getCookie(c, SESSION_COOKIE_NAME));
    const requireMfa = user.mfaEnabled && !settings.authDisableMfa;
    const cookieValue = await issueSession(options.sessions, {
      session: current,
      userId: user.id,
      mfaVerified: !requireMfa,
      rememberMe: false,
      request: c.req.raw,
    });
    options.sessions.attachCookie(c, cookieValue, false);

    if (requireMfa) {
      return c.json({ requiresMfa: true });
    }

    return c.json({ user: await toPublicAccount(options, user) });
  });
}
