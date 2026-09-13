import { AuthTokenType } from "@fluxo/types";
import type { Hono } from "hono";
import type { AppBindings } from "../../app-bindings.js";
import { hashPassword, verifyPassword } from "../../auth/passwords.js";
import { emailChangeBodySchema, passwordChangeBodySchema } from "../../auth/schemas.js";
import {
  createAuthToken,
  EMAIL_CONFIRM_TTL_MS,
  hashAuthToken,
  PASSWORD_RESET_TTL_MS,
} from "../../auth/tokens.js";
import { sendAuthMail } from "../../settings/guards.js";
import type { AuthRouteOptions } from "./shared.js";
import { assertStepUp, stubToken, toPublicAccount } from "./shared.js";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function registerEmailPasswordRoutes(routes: Hono<AppBindings>, options: AuthRouteOptions): void {
  routes.post("/email/change", async (c) => {
    const parsed = emailChangeBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const account = c.get("account");
    const blocked = await assertStepUp(c, options, account, parsed.data.challengeId);
    if (blocked) {
      return blocked;
    }

    if (parsed.data.email === account.email) {
      return c.json({ error: "Email is unchanged" }, 400);
    }

    const taken = await options.users.findByEmail(parsed.data.email);
    if (taken) {
      return c.json({ error: "Email already in use" }, 409);
    }

    await options.users.update(account.id, { emailVerifiedAt: null });
    await options.tokens.deleteByUserIdAndType(account.id, AuthTokenType.EmailConfirm);
    const token = createAuthToken();
    await options.tokens.create({
      tokenHash: hashAuthToken(token),
      userId: account.id,
      type: AuthTokenType.EmailConfirm,
      data: JSON.stringify({ email: parsed.data.email }),
      expiresAt: new Date(Date.now() + EMAIL_CONFIRM_TTL_MS),
    });
    options.logger.info("auth.email_change.created", { userId: account.id });
    const settings = options.settings.current();
    await sendAuthMail(options, {
      to: parsed.data.email,
      subject: `Confirm your new ${settings.appName} email`,
      text: `Confirm your email change: ${settings.appBaseUrl}/confirm-email?token=${token}`,
    });
    return c.json({ ok: true, ...stubToken(options, token) });
  });

  routes.post("/password", async (c) => {
    const parsed = passwordChangeBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    if (options.settings.current().authDisablePasswordChange) {
      return c.json({ code: "password_change_disabled" }, 403);
    }

    const account = c.get("account");
    const blocked = await assertStepUp(c, options, account, parsed.data.challengeId);
    if (blocked) {
      return blocked;
    }

    let authorized = false;
    if (parsed.data.currentPassword) {
      authorized = await verifyPassword(parsed.data.currentPassword, account.passwordHash);
    } else if (parsed.data.token) {
      const consumed = await options.tokens.consume(
        hashAuthToken(parsed.data.token),
        AuthTokenType.PasswordReset,
      );
      authorized = consumed?.userId === account.id;
    }

    if (!authorized) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const passwordHash = await hashPassword(parsed.data.newPassword, options.config.bcryptRounds);
    const updated = await options.users.update(account.id, { passwordHash });
    if (!updated) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const session = c.get("session");
    await options.sessions.destroyOthersForUser(account.id, session.id);
    return c.json({ user: await toPublicAccount(options, updated) });
  });

  routes.post("/password/email-challenge", async (c) => {
    if (options.settings.current().authDisablePasswordChange) {
      return c.json({ code: "password_change_disabled" }, 403);
    }

    const account = c.get("account");
    await options.tokens.deleteByUserIdAndType(account.id, AuthTokenType.PasswordReset);
    const token = createAuthToken();
    await options.tokens.create({
      tokenHash: hashAuthToken(token),
      userId: account.id,
      type: AuthTokenType.PasswordReset,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    options.logger.info("auth.password_email_challenge.created", { userId: account.id });
    const settings = options.settings.current();
    await sendAuthMail(options, {
      to: account.email,
      subject: `Confirm a password change on ${settings.appName}`,
      text: `Use this link to confirm your password change: ${settings.appBaseUrl}/settings?tab=security&token=${token}`,
    });
    return c.json({ ok: true, ...stubToken(options, token) });
  });
}
