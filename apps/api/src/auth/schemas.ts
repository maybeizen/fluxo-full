import { UserRole } from "@fluxo/types";
import { z } from "zod";

export const registerBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform((value) => value.toLowerCase()),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  captchaToken: z.string().trim().min(1).optional(),
});

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  remember: z.boolean().optional(),
  captchaToken: z.string().trim().min(1).optional(),
});

export const mfaBodySchema = z.object({
  code: z.string().trim().min(6).max(64),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  captchaToken: z.string().trim().min(1).optional(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const confirmEmailBodySchema = z.object({
  token: z.string().min(1),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const profileBodySchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  dateOfBirth: z.union([isoDate, z.null()]).optional(),
  company: z
    .union([z.string().trim().max(120), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value)),
});

export const emailChangeBodySchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  challengeId: z.string().min(1).optional(),
});

export const passwordChangeBodySchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
    newPassword: z.string().min(8).max(128),
    challengeId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.currentPassword || value.token));

export const mfaEnableBodySchema = z.object({
  code: z.string().trim().min(6).max(64),
});

export const mfaDisableBodySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().trim().min(6).max(64).optional(),
});

export const stepUpTotpBodySchema = z.object({
  code: z.string().trim().min(6).max(64),
});

export const passkeyLoginOptionsBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase())
    .optional(),
  rememberMe: z.boolean().optional(),
  captchaToken: z.string().trim().min(1).optional(),
});

export const passkeyNameSchema = z.string().trim().min(1).max(64).optional();

const userRoleSchema = z.union([z.literal(UserRole.User), z.literal(UserRole.Admin)]);

export const adminCreateUserBodySchema = registerBodySchema.extend({
  role: userRoleSchema.optional(),
  emailVerified: z.boolean().optional(),
});

export const adminPatchUserBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_]+$/)
      .transform((value) => value.toLowerCase())
      .optional(),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()).optional(),
    dateOfBirth: z.union([isoDate, z.null()]).optional(),
    company: z
      .union([z.string().trim().max(120), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    role: userRoleSchema.optional(),
    emailVerified: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
    suspended: z.boolean().optional(),
    suspendedReason: z
      .union([z.string().trim().min(1).max(500), z.null()])
      .optional(),
  })
  .refine((value) => value.suspended !== true || Boolean(value.suspendedReason), {
    message: "suspendedReason is required when suspending",
    path: ["suspendedReason"],
  });
