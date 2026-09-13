import type { Context } from "hono";
import { UserRole } from "@fluxo/types";
import type { AppBindings } from "../app-bindings.js";
import type { UserRecord } from "../auth/stores/types.js";
import type { AuthRouteOptions } from "../routes/account/shared.js";

export async function rejectCaptcha(
  c: Context<AppBindings>,
  options: AuthRouteOptions,
  token: string | undefined,
): Promise<Response | null> {
  const result = await options.settings.verifyCaptcha(token);
  if (result === "required") {
    return c.json({ code: "captcha_required" }, 400);
  }
  if (result === "invalid") {
    return c.json({ code: "captcha_invalid" }, 400);
  }
  return null;
}

export function loginAllowed(user: UserRecord, disableLogin: boolean): boolean {
  if (!disableLogin) {
    return true;
  }
  return user.role === UserRole.Admin;
}

export function emailVerificationRequired(
  user: UserRecord,
  disableRequirement: boolean,
): boolean {
  if (disableRequirement) {
    return false;
  }
  return user.emailVerifiedAt === null;
}

export async function sendAuthMail(
  options: AuthRouteOptions,
  input: { to: string; subject: string; text: string },
): Promise<void> {
  try {
    await options.settings.sendMail(input);
  } catch (error) {
    options.logger.error("mail.send_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
