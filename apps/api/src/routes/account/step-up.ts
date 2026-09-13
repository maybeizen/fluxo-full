import type { Hono } from "hono";
import type { AppBindings } from "../../app-bindings.js";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { hashBackupCode, normalizeBackupCode } from "../../auth/backup-codes.js";
import { openMfaSecret, verifyTotp } from "../../auth/mfa.js";
import { stepUpTotpBodySchema } from "../../auth/schemas.js";
import {
  decodePublicKey,
  parseTransports,
  relyingParty,
} from "../../auth/webauthn.js";
import type { AuthRouteOptions } from "./shared.js";
import { issueStepUp, WEBAUTHN_CHALLENGE_TTL_SECONDS } from "./shared.js";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isAuthenticationResponse(value: unknown): value is AuthenticationResponseJSON {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.response === "object";
}

export function registerStepUpRoutes(routes: Hono<AppBindings>, options: AuthRouteOptions): void {
  routes.post("/step-up/totp", async (c) => {
    const parsed = stepUpTotpBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const account = c.get("account");
    if (!account.mfaEnabled || !account.mfaSecret) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let secret: string;
    try {
      secret = openMfaSecret(account.mfaSecret, options.config.appKey);
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const totpValid = verifyTotp(secret, parsed.data.code);
    const backupValid = totpValid
      ? false
      : await options.backupCodes.consume(account.id, hashBackupCode(normalizeBackupCode(parsed.data.code)));
    if (!totpValid && !backupValid) {
      return c.json({ error: "Invalid code" }, 401);
    }

    const session = c.get("session");
    return c.json(await issueStepUp(options, account.id, session.id));
  });

  routes.post("/step-up/passkey/options", async (c) => {
    const account = c.get("account");
    const credentials = await options.passkeys.listByUserId(account.id);
    if (credentials.length === 0) {
      return c.json({ error: "No passkeys" }, 400);
    }

    const rp = relyingParty(options.config);
    const webauthnOptions = await options.webauthn.authenticationOptions({
      rpID: rp.rpID,
      allowCredentials: credentials.map((credential) => ({
        id: credential.id,
        transports: parseTransports(credential.transports),
      })),
    });
    await options.webauthnChallenges.set(
      `step-up:${account.id}`,
      webauthnOptions.challenge,
      WEBAUTHN_CHALLENGE_TTL_SECONDS,
    );
    return c.json(webauthnOptions);
  });

  routes.post("/step-up/passkey/verify", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isAuthenticationResponse(body)) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const account = c.get("account");
    const expectedChallenge = await options.webauthnChallenges.consume(`step-up:${account.id}`);
    if (!expectedChallenge) {
      return c.json({ error: "Invalid or expired challenge" }, 400);
    }

    const credential = await options.passkeys.findById(body.id);
    if (!credential || credential.userId !== account.id) {
      return c.json({ error: "Unknown passkey" }, 400);
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
    const session = c.get("session");
    return c.json(await issueStepUp(options, account.id, session.id));
  });
}
