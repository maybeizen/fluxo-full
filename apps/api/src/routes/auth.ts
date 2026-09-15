import { AuthTokenType, UserRole } from "@fluxo/types";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import type { AppBindings } from "../app-bindings.js";
import { hashBackupCode, normalizeBackupCode } from "../auth/backup-codes.js";
import { SESSION_COOKIE_NAME } from "../auth/cookie.js";
import { issueSession } from "../auth/issue-session.js";
import { gravatarUrl } from "../auth/gravatar.js";
import { openMfaSecret, verifyTotp } from "../auth/mfa.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { requireSession } from "../auth/require-session.js";
import {
  confirmEmailBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  mfaBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from "../auth/schemas.js";
import {
  createAuthToken,
  EMAIL_CONFIRM_TTL_MS,
  hashAuthToken,
  PASSWORD_RESET_TTL_MS,
} from "../auth/tokens.js";
import { registerEmailPasswordRoutes } from "./account/email-password.js";
import { registerMfaRoutes } from "./account/mfa.js";
import {
  registerPasskeyLoginRoutes,
  registerPasskeyRoutes,
} from "./account/passkeys.js";
import { registerProfileRoutes } from "./account/profile.js";
import { registerSessionRoutes } from "./account/sessions.js";
import type { AuthRouteOptions } from "./account/shared.js";
import { parseEmailTokenData, toPublicAccount } from "./account/shared.js";
import { registerStepUpRoutes } from "./account/step-up.js";
import {
  emailVerificationRequired,
  loginAllowed,
  rejectCaptcha,
  sendAuthMail,
} from "../settings/guards.js";
import { emitForgeEvent } from "../forge/events.js";

export type { AuthRouteOptions };

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function loadAuthenticatedUser(
  options: AuthRouteOptions,
  cookie: string | undefined,
) {
  const session = await options.sessions.resolve(cookie);
  if (!session) {
    return { session: null, user: null } as const;
  }

  const user = await options.users.findById(session.userId);
  if (!user) {
    return { session: null, user: null } as const;
  }

  return { session, user } as const;
}

export function authRoutes(options: AuthRouteOptions) {
  const routes = new Hono<AppBindings>();

  routes.post("/register", async (c) => {
    const parsed = registerBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const captcha = await rejectCaptcha(c, options, parsed.data.captchaToken);
    if (captcha) {
      return captcha;
    }

    const settings = options.settings.current();
    const isFirstUser = (await options.users.count()) === 0;
    if (settings.authDisableRegistration && !isFirstUser) {
      return c.json({ code: "registration_disabled" }, 403);
    }

    const body = parsed.data;
    const existing =
      (await options.users.findByUsername(body.username)) ??
      (await options.users.findByEmail(body.email));
    if (existing) {
      return c.json({ error: "Username or email already in use" }, 409);
    }

    const passwordHash = await hashPassword(
      body.password,
      options.config.bcryptRounds,
    );
    const skipVerification =
      settings.authDisableEmailVerificationRequirement ||
      options.config.nodeEnv !== "production";
    const user = await options.users.create({
      username: body.username,
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      role: isFirstUser ? UserRole.Admin : UserRole.User,
      emailVerifiedAt: skipVerification ? new Date() : null,
    });
    await emitForgeEvent("user.created", { userId: user.id });

    if (!skipVerification) {
      const token = createAuthToken();
      await options.tokens.create({
        tokenHash: hashAuthToken(token),
        userId: user.id,
        type: AuthTokenType.EmailConfirm,
        expiresAt: new Date(Date.now() + EMAIL_CONFIRM_TTL_MS),
      });
      options.logger.info("auth.email_confirm.created", { userId: user.id });
      await sendAuthMail(options, {
        to: user.email,
        subject: `Confirm your ${settings.appName} email`,
        text: `Confirm your email: ${settings.appBaseUrl}/confirm-email?token=${token}`,
      });
    }

    return c.json({ user: await toPublicAccount(options, user) }, 201);
  });

  routes.post("/login", async (c) => {
    const parsed = loginBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const captcha = await rejectCaptcha(c, options, parsed.data.captchaToken);
    if (captcha) {
      return captcha;
    }

    const rememberMe = parsed.data.rememberMe ?? parsed.data.remember ?? false;
    const user = await options.users.findByUsername(parsed.data.username);
    if (
      !user ||
      !(await verifyPassword(parsed.data.password, user.passwordHash))
    ) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const settings = options.settings.current();
    if (!loginAllowed(user, settings.authDisableLogin)) {
      return c.json({ code: "login_disabled" }, 403);
    }

    if (
      emailVerificationRequired(
        user,
        settings.authDisableEmailVerificationRequirement,
      )
    ) {
      return c.json({ code: "email_not_verified" }, 403);
    }

    const requireMfa = user.mfaEnabled && !settings.authDisableMfa;
    const current = await options.sessions.resolve(
      getCookie(c, SESSION_COOKIE_NAME),
    );
    const cookieValue = await issueSession(options.sessions, {
      session: current,
      userId: user.id,
      mfaVerified: !requireMfa,
      rememberMe,
      request: c.req.raw,
    });
    options.sessions.attachCookie(c, cookieValue, rememberMe);

    if (requireMfa) {
      return c.json({ requiresMfa: true });
    }

    return c.json({ user: await toPublicAccount(options, user) });
  });

  routes.post("/mfa", async (c) => {
    const parsed = mfaBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const { session, user } = await loadAuthenticatedUser(
      options,
      getCookie(c, SESSION_COOKIE_NAME),
    );
    if (!session || !user || !user.mfaEnabled) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let totpValid = false;
    if (user.mfaSecret) {
      try {
        const secret = openMfaSecret(user.mfaSecret, options.config.appKey);
        totpValid = verifyTotp(secret, parsed.data.code);
      } catch {
        totpValid = false;
      }
    }

    const backupValid = totpValid
      ? false
      : await options.backupCodes.consume(
          user.id,
          hashBackupCode(normalizeBackupCode(parsed.data.code)),
        );
    if (!totpValid && !backupValid) {
      return c.json({ error: "Invalid code" }, 401);
    }

    await options.sessions.markMfaVerified(session);
    return c.json({ user: await toPublicAccount(options, user) });
  });

  routes.post("/logout", async (c) => {
    await options.sessions.destroy(getCookie(c, SESSION_COOKIE_NAME));
    options.sessions.clearCookie(c);
    return c.json({ ok: true });
  });

  routes.get("/me", async (c) => {
    const { session, user } = await loadAuthenticatedUser(
      options,
      getCookie(c, SESSION_COOKIE_NAME),
    );
    if (!session || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (user.mfaEnabled && !session.mfaVerified) {
      return c.json({ code: "mfa_required" }, 401);
    }

    await options.sessions.touch(session);
    return c.json({ user: await toPublicAccount(options, user) });
  });

  routes.post("/forgot-password", async (c) => {
    const parsed = forgotPasswordBodySchema.safeParse(
      await readJson(c.req.raw),
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const captcha = await rejectCaptcha(c, options, parsed.data.captchaToken);
    if (captcha) {
      return captcha;
    }

    const settings = options.settings.current();
    if (settings.authDisablePasswordChange) {
      return c.json({ code: "password_change_disabled" }, 403);
    }

    const user = await options.users.findByEmail(parsed.data.email);
    if (user) {
      const token = createAuthToken();
      await options.tokens.create({
        tokenHash: hashAuthToken(token),
        userId: user.id,
        type: AuthTokenType.PasswordReset,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });
      options.logger.info("auth.password_reset.created", { userId: user.id });
      await sendAuthMail(options, {
        to: user.email,
        subject: `Reset your ${settings.appName} password`,
        text: `Reset your password: ${settings.appBaseUrl}/reset-password?token=${token}`,
      });
    }

    return c.json({ ok: true });
  });

  routes.post("/reset-password", async (c) => {
    const parsed = resetPasswordBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    if (options.settings.current().authDisablePasswordChange) {
      return c.json({ code: "password_change_disabled" }, 403);
    }

    const consumed = await options.tokens.consume(
      hashAuthToken(parsed.data.token),
      AuthTokenType.PasswordReset,
    );
    if (!consumed) {
      return c.json({ error: "Invalid or expired token" }, 400);
    }

    const passwordHash = await hashPassword(
      parsed.data.password,
      options.config.bcryptRounds,
    );
    await options.users.updatePassword(consumed.userId, passwordHash);
    await options.sessions.destroyAllForUser(consumed.userId);
    return c.json({ ok: true });
  });

  routes.post("/confirm-email", async (c) => {
    const parsed = confirmEmailBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const consumed = await options.tokens.consume(
      hashAuthToken(parsed.data.token),
      AuthTokenType.EmailConfirm,
    );
    if (!consumed) {
      return c.json({ error: "Invalid or expired token" }, 400);
    }

    const nextEmail = parseEmailTokenData(consumed.data).email;
    if (nextEmail) {
      const taken = await options.users.findByEmail(nextEmail);
      if (taken && taken.id !== consumed.userId) {
        return c.json({ error: "Email already in use" }, 409);
      }
      const user = await options.users.findById(consumed.userId);
      await options.users.update(consumed.userId, {
        email: nextEmail,
        emailVerifiedAt: new Date(),
        avatarUrl:
          user?.avatarSource === "gravatar"
            ? gravatarUrl(nextEmail)
            : undefined,
      });
      return c.json({ ok: true });
    }

    await options.users.markEmailVerified(consumed.userId);
    return c.json({ ok: true });
  });

  registerPasskeyLoginRoutes(routes, options);

  const account = new Hono<AppBindings>();
  account.use(
    "*",
    requireSession({
      sessions: options.sessions,
      users: options.users,
      passkeys: options.passkeys,
    }),
  );
  registerProfileRoutes(account, options);
  registerEmailPasswordRoutes(account, options);
  registerMfaRoutes(account, options);
  registerStepUpRoutes(account, options);
  registerPasskeyRoutes(account, options);
  registerSessionRoutes(account, options);
  routes.route("/", account);

  return routes;
}
