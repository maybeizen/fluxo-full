import type { Hono } from "hono";
import type { AppBindings } from "../../app-bindings.js";
import { generateBackupCodes, hashBackupCode, normalizeBackupCode } from "../../auth/backup-codes.js";
import { createOtpauthUrl, generateTotpSecret, openMfaSecret, sealMfaSecret, verifyTotp } from "../../auth/mfa.js";
import { mfaDisableBodySchema, mfaEnableBodySchema } from "../../auth/schemas.js";
import type { AuthRouteOptions } from "./shared.js";
import { assertStepUp, toPublicAccount } from "./shared.js";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function registerMfaRoutes(routes: Hono<AppBindings>, options: AuthRouteOptions): void {
  routes.post("/mfa/setup", async (c) => {
    if (options.settings.current().authDisableMfa) {
      return c.json({ code: "mfa_disabled" }, 403);
    }

    const account = c.get("account");
    if (account.mfaEnabled) {
      return c.json({ error: "MFA already enabled" }, 409);
    }

    const secret = generateTotpSecret();
    await options.users.updateMfa(account.id, {
      mfaEnabled: false,
      mfaSecret: sealMfaSecret(secret, options.config.appKey),
    });
    const otpauthUrl = createOtpauthUrl({
      secret,
      label: account.username,
      issuer: options.config.appName,
    });
    return c.json({ secret, otpauthUrl });
  });

  routes.post("/mfa/enable", async (c) => {
    if (options.settings.current().authDisableMfa) {
      return c.json({ code: "mfa_disabled" }, 403);
    }

    const parsed = mfaEnableBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const account = c.get("account");
    if (account.mfaEnabled) {
      return c.json({ error: "MFA already enabled" }, 409);
    }
    if (!account.mfaSecret) {
      return c.json({ error: "MFA is not set up" }, 400);
    }

    let secret: string;
    try {
      secret = openMfaSecret(account.mfaSecret, options.config.appKey);
    } catch {
      return c.json({ error: "MFA is not set up" }, 400);
    }

    if (!verifyTotp(secret, parsed.data.code)) {
      return c.json({ error: "Invalid code" }, 401);
    }

    const backupCodes = generateBackupCodes();
    await options.backupCodes.replaceAll(account.id, backupCodes.map(hashBackupCode));
    await options.users.updateMfa(account.id, {
      mfaEnabled: true,
      mfaSecret: account.mfaSecret,
    });
    const updated = await options.users.findById(account.id);
    if (!updated) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const session = c.get("session");
    await options.sessions.markMfaVerified(session);
    return c.json({
      user: await toPublicAccount(options, updated),
      backupCodes,
      suggestDownload: true,
    });
  });

  routes.post("/mfa/disable", async (c) => {
    const parsed = mfaDisableBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const account = c.get("account");
    const blocked = await assertStepUp(c, options, account, parsed.data.challengeId);
    if (blocked) {
      return blocked;
    }

    if (parsed.data.code) {
      let valid = false;
      if (account.mfaSecret) {
        try {
          const secret = openMfaSecret(account.mfaSecret, options.config.appKey);
          valid = verifyTotp(secret, parsed.data.code);
        } catch {
          valid = false;
        }
      }
      if (!valid) {
        valid = await options.backupCodes.consume(account.id, hashBackupCode(normalizeBackupCode(parsed.data.code)));
      }
      if (!valid) {
        return c.json({ error: "Invalid code" }, 401);
      }
    }

    await options.users.updateMfa(account.id, { mfaEnabled: false, mfaSecret: null });
    await options.backupCodes.deleteAll(account.id);
    const updated = await options.users.findById(account.id);
    if (!updated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.json({ user: await toPublicAccount(options, updated) });
  });
}
