import type { FluxoLogger } from "@fluxo/logger";
import type { Context } from "hono";
import type { AppBindings } from "../../app-bindings.js";
import type { AuthServices } from "../../auth/create-auth.js";
import type { UserRecord } from "../../auth/stores/types.js";
import { toPublicUser } from "../../auth/to-public-user.js";
import { createAuthToken } from "../../auth/tokens.js";

export const STEP_UP_TTL_MS = 5 * 60 * 1000;
export const WEBAUTHN_CHALLENGE_TTL_SECONDS = 300;

export interface AuthRouteOptions extends AuthServices {
  logger: FluxoLogger;
}

export async function toPublicAccount(options: AuthRouteOptions, user: UserRecord) {
  return toPublicUser(user, await options.passkeys.hasForUser(user.id));
}

export function parseEmailTokenData(data: string | null): { email?: string } {
  if (!data) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    return typeof record.email === "string" ? { email: record.email } : {};
  } catch {
    return {};
  }
}

export async function requiresStepUp(options: AuthRouteOptions, user: UserRecord): Promise<boolean> {
  return user.mfaEnabled || (await options.passkeys.hasForUser(user.id));
}

export async function assertStepUp(
  c: Context<AppBindings>,
  options: AuthRouteOptions,
  user: UserRecord,
  challengeId: string | undefined,
): Promise<Response | null> {
  if (!(await requiresStepUp(options, user))) {
    return null;
  }
  if (!challengeId) {
    return c.json({ code: "step_up_required" }, 403);
  }
  const session = c.get("session");
  const ok = await options.stepUps.consume(challengeId, user.id, session.id);
  if (!ok) {
    return c.json({ code: "step_up_invalid" }, 403);
  }
  return null;
}

export async function issueStepUp(
  options: AuthRouteOptions,
  userId: string,
  sessionId: string,
): Promise<{ challengeId: string; expiresAt: string }> {
  const challengeId = createAuthToken();
  const expiresAt = new Date(Date.now() + STEP_UP_TTL_MS);
  await options.stepUps.create({
    id: challengeId,
    userId,
    sessionId,
    expiresAt,
  });
  return { challengeId, expiresAt: expiresAt.toISOString() };
}

export function stubToken(options: AuthRouteOptions, token: string): { token?: string } {
  return options.config.nodeEnv === "production" ? {} : { token };
}
