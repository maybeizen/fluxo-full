import type { CaptchaType, FluxoThemeId, StorageProvider } from "@fluxo/types";
import { isFluxoThemeId } from "@fluxo/types";
import type { ResolvedSettings } from "./defaults.js";
import { openSecret, sealSecret } from "./secrets.js";

export interface PersistedSettings {
  appName?: unknown;
  appBaseUrl?: unknown;
  appIconKey?: unknown;
  appIconRevision?: unknown;
  activeThemeId?: unknown;
  authDisableEmailVerificationRequirement?: unknown;
  authDisableRegistration?: unknown;
  authDisableLogin?: unknown;
  authDisablePasswordChange?: unknown;
  authDisableMfa?: unknown;
  authStopOutgoingEmails?: unknown;
  emailSmtpHost?: unknown;
  emailSmtpPort?: unknown;
  emailSmtpUser?: unknown;
  emailSmtpPass?: unknown;
  emailFromAddress?: unknown;
  storageProvider?: unknown;
  s3Endpoint?: unknown;
  s3Region?: unknown;
  s3Bucket?: unknown;
  s3AccessKeyId?: unknown;
  s3SecretAccessKey?: unknown;
  s3ForcePathStyle?: unknown;
  s3PublicUrlBase?: unknown;
  securityCaptchaType?: unknown;
  securityCaptchaEnabled?: unknown;
  securityCaptchaSiteKey?: unknown;
  securityCaptchaSecretKey?: unknown;
  appSupportTicketsEnabled?: unknown;
  appMaintenanceModeEnabled?: unknown;
  appMaintenanceMessage?: unknown;
  appDebugMode?: unknown;
  appGlobalBannerAnnouncementEnabled?: unknown;
  appGlobalBannerAnnouncementMessage?: unknown;
  billingCurrency?: unknown;
  billingLocale?: unknown;
  billingTimezone?: unknown;
  billingInvoicePrefix?: unknown;
  billingInvoiceDueDays?: unknown;
  billingTaxEnabled?: unknown;
  billingTaxInclusive?: unknown;
  billingTaxRate?: unknown;
  billingTaxLabel?: unknown;
  billingCompanyName?: unknown;
  billingCompanyAddress?: unknown;
  billingSupportEmail?: unknown;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown, fallback: string | null): string | null {
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asThemeId(value: unknown, fallback: FluxoThemeId): FluxoThemeId {
  return typeof value === "string" && isFluxoThemeId(value) ? value : fallback;
}

function asStorageProvider(value: unknown, fallback: StorageProvider): StorageProvider {
  return value === "local" || value === "s3" ? value : fallback;
}

function asCaptchaType(value: unknown, fallback: CaptchaType): CaptchaType {
  if (value === "none" || value === "recaptcha" || value === "hcaptcha" || value === "turnstile") {
    return value;
  }
  return fallback;
}

export function parsePersisted(
  raw: string,
  base: ResolvedSettings,
  appKey: string,
): ResolvedSettings {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return base;
  }
  const row = parsed as PersistedSettings;
  return {
    appName: asString(row.appName, base.appName),
    appBaseUrl: asString(row.appBaseUrl, base.appBaseUrl).replace(/\/$/, ""),
    appIconKey: asNullableString(row.appIconKey, base.appIconKey),
    appIconRevision: asNullableString(row.appIconRevision, base.appIconRevision),
    activeThemeId: asThemeId(row.activeThemeId, base.activeThemeId),
    authDisableEmailVerificationRequirement: asBoolean(
      row.authDisableEmailVerificationRequirement,
      base.authDisableEmailVerificationRequirement,
    ),
    authDisableRegistration: asBoolean(row.authDisableRegistration, base.authDisableRegistration),
    authDisableLogin: asBoolean(row.authDisableLogin, base.authDisableLogin),
    authDisablePasswordChange: asBoolean(
      row.authDisablePasswordChange,
      base.authDisablePasswordChange,
    ),
    authDisableMfa: asBoolean(row.authDisableMfa, base.authDisableMfa),
    authStopOutgoingEmails: asBoolean(row.authStopOutgoingEmails, base.authStopOutgoingEmails),
    emailSmtpHost: asNullableString(row.emailSmtpHost, base.emailSmtpHost),
    emailSmtpPort: asNullableNumber(row.emailSmtpPort, base.emailSmtpPort),
    emailSmtpUser: asNullableString(row.emailSmtpUser, base.emailSmtpUser),
    emailSmtpPass: openSecret(row.emailSmtpPass, appKey) ?? (row.emailSmtpPass === undefined ? base.emailSmtpPass : null),
    emailFromAddress: asNullableString(row.emailFromAddress, base.emailFromAddress),
    storageProvider: asStorageProvider(row.storageProvider, base.storageProvider),
    s3Endpoint: asNullableString(row.s3Endpoint, base.s3Endpoint),
    s3Region: asNullableString(row.s3Region, base.s3Region),
    s3Bucket: asNullableString(row.s3Bucket, base.s3Bucket),
    s3AccessKeyId:
      openSecret(row.s3AccessKeyId, appKey) ?? (row.s3AccessKeyId === undefined ? base.s3AccessKeyId : null),
    s3SecretAccessKey:
      openSecret(row.s3SecretAccessKey, appKey) ??
      (row.s3SecretAccessKey === undefined ? base.s3SecretAccessKey : null),
    s3ForcePathStyle: asBoolean(row.s3ForcePathStyle, base.s3ForcePathStyle),
    s3PublicUrlBase: asNullableString(row.s3PublicUrlBase, base.s3PublicUrlBase),
    securityCaptchaType: asCaptchaType(row.securityCaptchaType, base.securityCaptchaType),
    securityCaptchaEnabled: asBoolean(row.securityCaptchaEnabled, base.securityCaptchaEnabled),
    securityCaptchaSiteKey: asNullableString(row.securityCaptchaSiteKey, base.securityCaptchaSiteKey),
    securityCaptchaSecretKey:
      openSecret(row.securityCaptchaSecretKey, appKey) ??
      (row.securityCaptchaSecretKey === undefined ? base.securityCaptchaSecretKey : null),
    appSupportTicketsEnabled: asBoolean(
      row.appSupportTicketsEnabled,
      base.appSupportTicketsEnabled,
    ),
    appMaintenanceModeEnabled: asBoolean(
      row.appMaintenanceModeEnabled,
      base.appMaintenanceModeEnabled,
    ),
    appMaintenanceMessage: asString(row.appMaintenanceMessage, base.appMaintenanceMessage),
    appDebugMode: asBoolean(row.appDebugMode, base.appDebugMode),
    appGlobalBannerAnnouncementEnabled: asBoolean(
      row.appGlobalBannerAnnouncementEnabled,
      base.appGlobalBannerAnnouncementEnabled,
    ),
    appGlobalBannerAnnouncementMessage: asString(
      row.appGlobalBannerAnnouncementMessage,
      base.appGlobalBannerAnnouncementMessage,
    ),
    billingCurrency: asString(row.billingCurrency, base.billingCurrency),
    billingLocale: asString(row.billingLocale, base.billingLocale),
    billingTimezone: asString(row.billingTimezone, base.billingTimezone),
    billingInvoicePrefix: asString(row.billingInvoicePrefix, base.billingInvoicePrefix),
    billingInvoiceDueDays: asNumber(row.billingInvoiceDueDays, base.billingInvoiceDueDays),
    billingTaxEnabled: asBoolean(row.billingTaxEnabled, base.billingTaxEnabled),
    billingTaxInclusive: asBoolean(row.billingTaxInclusive, base.billingTaxInclusive),
    billingTaxRate: asNumber(row.billingTaxRate, base.billingTaxRate),
    billingTaxLabel: asString(row.billingTaxLabel, base.billingTaxLabel),
    billingCompanyName: asString(row.billingCompanyName, base.billingCompanyName),
    billingCompanyAddress: asString(row.billingCompanyAddress, base.billingCompanyAddress),
    billingSupportEmail: asNullableString(row.billingSupportEmail, base.billingSupportEmail),
  };
}

export function serializePersisted(settings: ResolvedSettings, appKey: string): string {
  return JSON.stringify({
    appName: settings.appName,
    appBaseUrl: settings.appBaseUrl,
    appIconKey: settings.appIconKey,
    appIconRevision: settings.appIconRevision,
    activeThemeId: settings.activeThemeId,
    authDisableEmailVerificationRequirement: settings.authDisableEmailVerificationRequirement,
    authDisableRegistration: settings.authDisableRegistration,
    authDisableLogin: settings.authDisableLogin,
    authDisablePasswordChange: settings.authDisablePasswordChange,
    authDisableMfa: settings.authDisableMfa,
    authStopOutgoingEmails: settings.authStopOutgoingEmails,
    emailSmtpHost: settings.emailSmtpHost,
    emailSmtpPort: settings.emailSmtpPort,
    emailSmtpUser: settings.emailSmtpUser,
    emailSmtpPass: sealSecret(settings.emailSmtpPass, appKey),
    emailFromAddress: settings.emailFromAddress,
    storageProvider: settings.storageProvider,
    s3Endpoint: settings.s3Endpoint,
    s3Region: settings.s3Region,
    s3Bucket: settings.s3Bucket,
    s3AccessKeyId: sealSecret(settings.s3AccessKeyId, appKey),
    s3SecretAccessKey: sealSecret(settings.s3SecretAccessKey, appKey),
    s3ForcePathStyle: settings.s3ForcePathStyle,
    s3PublicUrlBase: settings.s3PublicUrlBase,
    securityCaptchaType: settings.securityCaptchaType,
    securityCaptchaEnabled: settings.securityCaptchaEnabled,
    securityCaptchaSiteKey: settings.securityCaptchaSiteKey,
    securityCaptchaSecretKey: sealSecret(settings.securityCaptchaSecretKey, appKey),
    appSupportTicketsEnabled: settings.appSupportTicketsEnabled,
    appMaintenanceModeEnabled: settings.appMaintenanceModeEnabled,
    appMaintenanceMessage: settings.appMaintenanceMessage,
    appDebugMode: settings.appDebugMode,
    appGlobalBannerAnnouncementEnabled: settings.appGlobalBannerAnnouncementEnabled,
    appGlobalBannerAnnouncementMessage: settings.appGlobalBannerAnnouncementMessage,
    billingCurrency: settings.billingCurrency,
    billingLocale: settings.billingLocale,
    billingTimezone: settings.billingTimezone,
    billingInvoicePrefix: settings.billingInvoicePrefix,
    billingInvoiceDueDays: settings.billingInvoiceDueDays,
    billingTaxEnabled: settings.billingTaxEnabled,
    billingTaxInclusive: settings.billingTaxInclusive,
    billingTaxRate: settings.billingTaxRate,
    billingTaxLabel: settings.billingTaxLabel,
    billingCompanyName: settings.billingCompanyName,
    billingCompanyAddress: settings.billingCompanyAddress,
    billingSupportEmail: settings.billingSupportEmail,
  });
}
