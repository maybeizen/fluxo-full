import type {
  AppSettingsAdmin,
  AppSettingsPublic,
  CaptchaType,
  FluxoThemeId,
  StorageProvider,
} from "@fluxo/types";
import { isFluxoThemeId } from "@fluxo/types";

export interface SettingsEnvSeed {
  appName: string;
  appBaseUrl: string;
  apiUrl: string;
  appKey: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  emailFrom?: string;
  storageProvider: StorageProvider;
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3ForcePathStyle: boolean;
  s3PublicUrlBase?: string;
}

export interface ResolvedSettings {
  appName: string;
  appBaseUrl: string;
  appIconKey: string | null;
  appIconRevision: string | null;
  activeThemeId: FluxoThemeId;
  authDisableEmailVerificationRequirement: boolean;
  authDisableRegistration: boolean;
  authDisableLogin: boolean;
  authDisablePasswordChange: boolean;
  authDisableMfa: boolean;
  authStopOutgoingEmails: boolean;
  emailSmtpHost: string | null;
  emailSmtpPort: number | null;
  emailSmtpUser: string | null;
  emailSmtpPass: string | null;
  emailFromAddress: string | null;
  storageProvider: StorageProvider;
  s3Endpoint: string | null;
  s3Region: string | null;
  s3Bucket: string | null;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
  s3ForcePathStyle: boolean;
  s3PublicUrlBase: string | null;
  securityCaptchaType: CaptchaType;
  securityCaptchaEnabled: boolean;
  securityCaptchaSiteKey: string | null;
  securityCaptchaSecretKey: string | null;
  appSupportTicketsEnabled: boolean;
  appMaintenanceModeEnabled: boolean;
  appMaintenanceMessage: string;
  appDebugMode: boolean;
  appGlobalBannerAnnouncementEnabled: boolean;
  appGlobalBannerAnnouncementMessage: string;
  billingCurrency: string;
  billingLocale: string;
  billingTimezone: string;
  billingInvoicePrefix: string;
  billingInvoiceDueDays: number;
  billingTaxEnabled: boolean;
  billingTaxInclusive: boolean;
  billingTaxRate: number;
  billingTaxLabel: string;
  billingCompanyName: string;
  billingCompanyAddress: string;
  billingSupportEmail: string | null;
}

export function seedFromEnv(env: SettingsEnvSeed): ResolvedSettings {
  return {
    appName: env.appName,
    appBaseUrl: env.appBaseUrl.replace(/\/$/, ""),
    appIconKey: null,
    appIconRevision: null,
    activeThemeId: "default",
    authDisableEmailVerificationRequirement: false,
    authDisableRegistration: false,
    authDisableLogin: false,
    authDisablePasswordChange: false,
    authDisableMfa: false,
    authStopOutgoingEmails: false,
    emailSmtpHost: env.smtpHost ?? null,
    emailSmtpPort: env.smtpPort ?? null,
    emailSmtpUser: env.smtpUser ?? null,
    emailSmtpPass: env.smtpPass ?? null,
    emailFromAddress: env.emailFrom ?? null,
    storageProvider: env.storageProvider,
    s3Endpoint: env.s3Endpoint ?? null,
    s3Region: env.s3Region ?? null,
    s3Bucket: env.s3Bucket ?? null,
    s3AccessKeyId: env.s3AccessKeyId ?? null,
    s3SecretAccessKey: env.s3SecretAccessKey ?? null,
    s3ForcePathStyle: env.s3ForcePathStyle,
    s3PublicUrlBase: env.s3PublicUrlBase ?? null,
    securityCaptchaType: "none",
    securityCaptchaEnabled: false,
    securityCaptchaSiteKey: null,
    securityCaptchaSecretKey: null,
    appSupportTicketsEnabled: true,
    appMaintenanceModeEnabled: false,
    appMaintenanceMessage: "",
    appDebugMode: false,
    appGlobalBannerAnnouncementEnabled: false,
    appGlobalBannerAnnouncementMessage: "",
    billingCurrency: "USD",
    billingLocale: "en-US",
    billingTimezone: "UTC",
    billingInvoicePrefix: "INV",
    billingInvoiceDueDays: 14,
    billingTaxEnabled: false,
    billingTaxInclusive: false,
    billingTaxRate: 0,
    billingTaxLabel: "Tax",
    billingCompanyName: "",
    billingCompanyAddress: "",
    billingSupportEmail: null,
  };
}

export function appIconUrl(settings: ResolvedSettings, apiUrl: string): string | null {
  if (!settings.appIconKey) {
    return null;
  }
  const base = settings.s3PublicUrlBase ?? `${apiUrl.replace(/\/$/, "")}/files`;
  const url = `${base.replace(/\/$/, "")}/${settings.appIconKey}`;
  const revision = settings.appIconRevision ?? "1";
  return `${url}?v=${encodeURIComponent(revision)}`;
}

export function toPublicSettings(settings: ResolvedSettings, apiUrl: string): AppSettingsPublic {
  return {
    appName: settings.appName,
    appBaseUrl: settings.appBaseUrl,
    appIconUrl: appIconUrl(settings, apiUrl),
    activeThemeId: isFluxoThemeId(settings.activeThemeId) ? settings.activeThemeId : "default",
    authDisableRegistration: settings.authDisableRegistration,
    authDisableLogin: settings.authDisableLogin,
    securityCaptchaType: settings.securityCaptchaType,
    securityCaptchaEnabled: settings.securityCaptchaEnabled,
    securityCaptchaSiteKey: settings.securityCaptchaSiteKey,
    appSupportTicketsEnabled: settings.appSupportTicketsEnabled,
    appMaintenanceModeEnabled: settings.appMaintenanceModeEnabled,
    appMaintenanceMessage: settings.appMaintenanceMessage,
    appGlobalBannerAnnouncementEnabled: settings.appGlobalBannerAnnouncementEnabled,
    appGlobalBannerAnnouncementMessage: settings.appGlobalBannerAnnouncementMessage,
    billingCurrency: settings.billingCurrency,
    billingLocale: settings.billingLocale,
    billingTimezone: settings.billingTimezone,
  };
}

export function toAdminSettings(settings: ResolvedSettings, apiUrl: string): AppSettingsAdmin {
  return {
    ...toPublicSettings(settings, apiUrl),
    authDisableEmailVerificationRequirement: settings.authDisableEmailVerificationRequirement,
    authDisablePasswordChange: settings.authDisablePasswordChange,
    authDisableMfa: settings.authDisableMfa,
    authStopOutgoingEmails: settings.authStopOutgoingEmails,
    emailSmtpHost: settings.emailSmtpHost,
    emailSmtpPort: settings.emailSmtpPort,
    emailSmtpUser: settings.emailSmtpUser,
    emailSmtpPassSet: Boolean(settings.emailSmtpPass),
    emailFromAddress: settings.emailFromAddress,
    storageProvider: settings.storageProvider,
    s3Endpoint: settings.s3Endpoint,
    s3Region: settings.s3Region,
    s3Bucket: settings.s3Bucket,
    s3AccessKeyIdSet: Boolean(settings.s3AccessKeyId),
    s3SecretAccessKeySet: Boolean(settings.s3SecretAccessKey),
    s3ForcePathStyle: settings.s3ForcePathStyle,
    s3PublicUrlBase: settings.s3PublicUrlBase,
    securityCaptchaSecretKeySet: Boolean(settings.securityCaptchaSecretKey),
    appDebugMode: settings.appDebugMode,
    billingInvoicePrefix: settings.billingInvoicePrefix,
    billingInvoiceDueDays: settings.billingInvoiceDueDays,
    billingTaxEnabled: settings.billingTaxEnabled,
    billingTaxInclusive: settings.billingTaxInclusive,
    billingTaxRate: settings.billingTaxRate,
    billingTaxLabel: settings.billingTaxLabel,
    billingCompanyName: settings.billingCompanyName,
    billingCompanyAddress: settings.billingCompanyAddress,
    billingSupportEmail: settings.billingSupportEmail,
  };
}
