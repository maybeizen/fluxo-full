import type {
  AppSettingsAdmin,
  AppSettingsAdminResponse,
  AppSettingsPatch,
  AppSettingsPublic,
  CaptchaType,
  FluxoThemeCatalogEntry,
  FluxoThemeId,
  StorageProvider,
} from "@fluxo/types";
import { z } from "zod";

export const themeIdSchema = z.enum(["default", "example"]);
export const storageProviderSchema = z.enum(["local", "s3"]);
export const captchaTypeSchema = z.enum(["none", "recaptcha", "hcaptcha", "turnstile"]);

export const publicSettingsFields = {
  appName: z.string(),
  appBaseUrl: z.string(),
  appIconUrl: z.string().nullable(),
  activeThemeId: themeIdSchema,
  authDisableRegistration: z.boolean(),
  authDisableLogin: z.boolean(),
  securityCaptchaType: captchaTypeSchema,
  securityCaptchaEnabled: z.boolean(),
  securityCaptchaSiteKey: z.string().nullable(),
  appSupportTicketsEnabled: z.boolean(),
  appMaintenanceModeEnabled: z.boolean(),
  appMaintenanceMessage: z.string(),
  appGlobalBannerAnnouncementEnabled: z.boolean(),
  appGlobalBannerAnnouncementMessage: z.string(),
  billingCurrency: z.string(),
  billingLocale: z.string(),
  billingTimezone: z.string(),
} satisfies z.ZodRawShape;

export const adminSettingsSchema: z.ZodType<AppSettingsAdmin> = z.object({
  ...publicSettingsFields,
  authDisableEmailVerificationRequirement: z.boolean(),
  authDisablePasswordChange: z.boolean(),
  authDisableMfa: z.boolean(),
  authStopOutgoingEmails: z.boolean(),
  emailSmtpHost: z.string().nullable(),
  emailSmtpPort: z.number().nullable(),
  emailSmtpUser: z.string().nullable(),
  emailSmtpPassSet: z.boolean(),
  emailFromAddress: z.string().nullable(),
  storageProvider: storageProviderSchema,
  s3Endpoint: z.string().nullable(),
  s3Region: z.string().nullable(),
  s3Bucket: z.string().nullable(),
  s3AccessKeyIdSet: z.boolean(),
  s3SecretAccessKeySet: z.boolean(),
  s3ForcePathStyle: z.boolean(),
  s3PublicUrlBase: z.string().nullable(),
  securityCaptchaSecretKeySet: z.boolean(),
  appDebugMode: z.boolean(),
  billingInvoicePrefix: z.string(),
  billingInvoiceDueDays: z.number(),
  billingTaxEnabled: z.boolean(),
  billingTaxInclusive: z.boolean(),
  billingTaxRate: z.number(),
  billingTaxLabel: z.string(),
  billingCompanyName: z.string(),
  billingCompanyAddress: z.string(),
  billingSupportEmail: z.string().nullable(),
});

export const themeCatalogEntrySchema: z.ZodType<FluxoThemeCatalogEntry> = z.object({
  id: themeIdSchema,
  name: z.string(),
  description: z.string(),
});

export const adminSettingsResponseSchema: z.ZodType<AppSettingsAdminResponse> = z.object({
  settings: adminSettingsSchema,
  themes: z.array(themeCatalogEntrySchema),
});

export type {
  AppSettingsAdmin,
  AppSettingsAdminResponse,
  AppSettingsPatch,
  AppSettingsPublic,
  CaptchaType,
  FluxoThemeId,
  StorageProvider,
};
