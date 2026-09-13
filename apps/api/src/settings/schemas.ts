import {
  CAPTCHA_TYPES,
  FLUXO_THEME_IDS,
  STORAGE_PROVIDERS,
  type AppSettingsPatch,
} from "@fluxo/types";
import { z } from "zod";

const secretPatch = z.union([z.string(), z.null()]).optional();
const optionalText = z.union([z.string(), z.null()]).optional();

export const appSettingsPatchSchema: z.ZodType<AppSettingsPatch> = z.object({
  appName: z.string().trim().min(1).max(80).optional(),
  appBaseUrl: z
    .string()
    .trim()
    .url()
    .max(255)
    .transform((value) => value.replace(/\/$/, ""))
    .optional(),
  activeThemeId: z.enum(FLUXO_THEME_IDS).optional(),
  authDisableEmailVerificationRequirement: z.boolean().optional(),
  authDisableRegistration: z.boolean().optional(),
  authDisableLogin: z.boolean().optional(),
  authDisablePasswordChange: z.boolean().optional(),
  authDisableMfa: z.boolean().optional(),
  authStopOutgoingEmails: z.boolean().optional(),
  emailSmtpHost: optionalText,
  emailSmtpPort: z.union([z.number().int().min(1).max(65535), z.null()]).optional(),
  emailSmtpUser: optionalText,
  emailSmtpPass: secretPatch,
  emailFromAddress: optionalText,
  storageProvider: z.enum(STORAGE_PROVIDERS).optional(),
  s3Endpoint: optionalText,
  s3Region: optionalText,
  s3Bucket: optionalText,
  s3AccessKeyId: secretPatch,
  s3SecretAccessKey: secretPatch,
  s3ForcePathStyle: z.boolean().optional(),
  s3PublicUrlBase: optionalText,
  securityCaptchaType: z.enum(CAPTCHA_TYPES).optional(),
  securityCaptchaEnabled: z.boolean().optional(),
  securityCaptchaSiteKey: optionalText,
  securityCaptchaSecretKey: secretPatch,
  appSupportTicketsEnabled: z.boolean().optional(),
  appMaintenanceModeEnabled: z.boolean().optional(),
  appMaintenanceMessage: z.string().max(2000).optional(),
  appDebugMode: z.boolean().optional(),
  appGlobalBannerAnnouncementEnabled: z.boolean().optional(),
  appGlobalBannerAnnouncementMessage: z.string().max(2000).optional(),
  billingCurrency: z.string().trim().min(3).max(8).optional(),
  billingLocale: z.string().trim().min(2).max(32).optional(),
  billingTimezone: z.string().trim().min(1).max(64).optional(),
  billingInvoicePrefix: z.string().trim().min(1).max(16).optional(),
  billingInvoiceDueDays: z.number().int().min(1).max(365).optional(),
  billingTaxEnabled: z.boolean().optional(),
  billingTaxInclusive: z.boolean().optional(),
  billingTaxRate: z.number().min(0).max(100).optional(),
  billingTaxLabel: z.string().trim().min(1).max(40).optional(),
  billingCompanyName: z.string().max(160).optional(),
  billingCompanyAddress: z.string().max(500).optional(),
  billingSupportEmail: z
    .union([z.string().trim().email().max(255), z.null(), z.literal("")])
    .optional(),
});
