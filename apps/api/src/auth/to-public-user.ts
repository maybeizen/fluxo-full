import type { PublicUser } from "@fluxo/types";
import type { UserRecord } from "./stores/types.js";

export function toPublicUser(user: UserRecord, hasPasskey = false): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    avatarSource: user.avatarSource,
    dateOfBirth: user.dateOfBirth,
    company: user.company,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.mfaEnabled,
    hasPasskey,
    suspended: user.suspendedAt !== null,
    suspendedReason: user.suspendedReason,
    createdAt: user.createdAt.toISOString(),
  };
}
