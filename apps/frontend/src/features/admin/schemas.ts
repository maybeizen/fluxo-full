import type { AdminUserDetail, AdminUserListItem, AdminUserListResponse } from "@fluxo/types";
import { z } from "zod";
import { avatarSourceSchema, userRoleSchema } from "@/lib/auth";

export const cannotDeleteSelfCode = "cannot_delete_self";
export const cannotDeleteLastAdminCode = "cannot_delete_last_admin";
export const cannotDemoteSelfCode = "cannot_demote_self";
export const cannotDemoteLastAdminCode = "cannot_demote_last_admin";
export const cannotSuspendSelfCode = "cannot_suspend_self";

export const adminUserListItemSchema: z.ZodType<AdminUserListItem> = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: userRoleSchema,
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  hasPasskey: z.boolean(),
  createdAt: z.string(),
  suspended: z.boolean(),
});

export const adminUserListResponseSchema: z.ZodType<AdminUserListResponse> = z.object({
  users: z.array(adminUserListItemSchema),
});

export const adminUserDetailSchema: z.ZodType<AdminUserDetail> = z.object({
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
  passkeys: z.array(z.object({ name: z.string() })),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable(),
  suspended: z.boolean(),
  suspendedAt: z.string().nullable(),
  suspendedReason: z.string().nullable(),
});

export const adminDeleteResponseSchema = z.object({
  ok: z.literal(true),
});
