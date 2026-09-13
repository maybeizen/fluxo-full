import {
  UserRole,
  type AuthMeResponse,
  type AvatarSource,
  type LoginResponse,
  type PublicUser,
} from "@fluxo/types";
import { z } from "zod";

export { UserRole };
export type { AuthMeResponse, AvatarSource, LoginResponse, PublicUser };

export const userRoleSchema = z.union([z.literal(UserRole.User), z.literal(UserRole.Admin)]);

export const avatarSourceSchema = z.enum(["upload", "gravatar", "none"]);

export const publicUserSchema: z.ZodType<PublicUser> = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
  avatarSource: avatarSourceSchema,
  dateOfBirth: z.string().nullable(),
  company: z.string().nullable(),
  role: userRoleSchema,
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  hasPasskey: z.boolean(),
  suspended: z.boolean(),
  suspendedReason: z.string().nullable(),
  createdAt: z.string(),
});

export const userEnvelopeSchema = z.object({
  user: publicUserSchema,
});

export const stepUpChallengeSchema = z.object({
  challengeId: z.string(),
  expiresAt: z.string(),
});

export const okTokenSchema = z.object({
  ok: z.literal(true),
  token: z.string().optional(),
});

export const mfaSetupSchema = z.object({
  secret: z.string(),
  otpauthUrl: z.string(),
});

export const mfaEnableSchema = z.object({
  user: publicUserSchema,
  backupCodes: z.array(z.string()),
  suggestDownload: z.boolean(),
});

export const authSessionInfoSchema = z.object({
  id: z.string(),
  current: z.boolean(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
});

export const authSessionsResponseSchema = z.object({
  sessions: z.array(authSessionInfoSchema),
});

export const authPasskeySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export const authPasskeysResponseSchema = z.object({
  passkeys: z.array(authPasskeySchema),
});

export type StepUpChallenge = z.infer<typeof stepUpChallengeSchema>;
export type OkTokenResponse = z.infer<typeof okTokenSchema>;
export type MfaSetup = z.infer<typeof mfaSetupSchema>;
export type MfaEnableResult = z.infer<typeof mfaEnableSchema>;
export type AuthSessionInfo = z.infer<typeof authSessionInfoSchema>;
export type AuthPasskey = z.infer<typeof authPasskeySchema>;

export const authSessionsQueryKey = ["auth", "sessions"] as const;
export const authPasskeysQueryKey = ["auth", "passkeys"] as const;

export const loginResponseSchema: z.ZodType<LoginResponse> = z.union([
  z.object({
    user: publicUserSchema,
    requiresMfa: z.literal(false).optional(),
  }),
  z.object({
    requiresMfa: z.literal(true),
  }),
]);

export const authMeResponseSchema: z.ZodType<AuthMeResponse> = z.object({
  user: publicUserSchema,
});

export const registerResponseSchema = authMeResponseSchema;

export type RegisterResponse = AuthMeResponse;

export const authErrorBodySchema = z.object({
  message: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export const mfaRequiredCode = "mfa_required";
export const stepUpRequiredCode = "step_up_required";
export const stepUpInvalidCode = "step_up_invalid";

export const authMeQueryKey = ["auth", "me"] as const;

export type AuthSession =
  | { status: "authenticated"; user: PublicUser }
  | { status: "mfa_required" }
  | { status: "unauthenticated" };

export class AuthApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.Admin;
}

export function userInitials(user: Pick<PublicUser, "firstName" | "lastName" | "username">): string {
  const first = user.firstName.trim().charAt(0);
  const last = user.lastName.trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  if (initials.length > 0) {
    return initials;
  }
  return user.username.slice(0, 2).toUpperCase();
}
