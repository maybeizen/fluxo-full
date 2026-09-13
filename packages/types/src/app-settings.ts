export const FLUXO_THEME_IDS = ["default", "example"] as const;

export type FluxoThemeId = (typeof FLUXO_THEME_IDS)[number];

export function isFluxoThemeId(value: string): value is FluxoThemeId {
  return (FLUXO_THEME_IDS as readonly string[]).includes(value);
}

export interface FluxoThemeCatalogEntry {
  id: FluxoThemeId;
  name: string;
  description: string;
}

export const FLUXO_THEME_CATALOG: readonly FluxoThemeCatalogEntry[] = [
  {
    id: "default",
    name: "Default",
    description: "Default Fluxo visual theme",
  },
  {
    id: "example",
    name: "Example",
    description: "Example theme that extends the default theme",
  },
];

export const STORAGE_PROVIDERS = ["local", "s3"] as const;

export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export const CAPTCHA_TYPES = ["none", "recaptcha", "hcaptcha", "turnstile"] as const;

export type CaptchaType = (typeof CAPTCHA_TYPES)[number];

export interface AppSettingsPublic {
  appName: string;
  appBaseUrl: string;
  appIconUrl: string | null;
  activeThemeId: FluxoThemeId;
  authDisableRegistration: boolean;
  authDisableLogin: boolean;
  securityCaptchaType: CaptchaType;
  securityCaptchaEnabled: boolean;
  securityCaptchaSiteKey: string | null;
  appSupportTicketsEnabled: boolean;
  appMaintenanceModeEnabled: boolean;
  appMaintenanceMessage: string;
  appGlobalBannerAnnouncementEnabled: boolean;
  appGlobalBannerAnnouncementMessage: string;
  billingCurrency: string;
  billingLocale: string;
  billingTimezone: string;
}

export interface AppSettingsAdmin extends AppSettingsPublic {
  authDisableEmailVerificationRequirement: boolean;
  authDisablePasswordChange: boolean;
  authDisableMfa: boolean;
  authStopOutgoingEmails: boolean;
  emailSmtpHost: string | null;
  emailSmtpPort: number | null;
  emailSmtpUser: string | null;
  emailSmtpPassSet: boolean;
  emailFromAddress: string | null;
  storageProvider: StorageProvider;
  s3Endpoint: string | null;
  s3Region: string | null;
  s3Bucket: string | null;
  s3AccessKeyIdSet: boolean;
  s3SecretAccessKeySet: boolean;
  s3ForcePathStyle: boolean;
  s3PublicUrlBase: string | null;
  securityCaptchaSecretKeySet: boolean;
  appDebugMode: boolean;
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

export interface AppSettingsAdminResponse {
  settings: AppSettingsAdmin;
  themes: readonly FluxoThemeCatalogEntry[];
}

export type SecretFieldPatch = string | null;

export interface AppSettingsPatch {
  appName?: string;
  appBaseUrl?: string;
  activeThemeId?: FluxoThemeId;
  authDisableEmailVerificationRequirement?: boolean;
  authDisableRegistration?: boolean;
  authDisableLogin?: boolean;
  authDisablePasswordChange?: boolean;
  authDisableMfa?: boolean;
  authStopOutgoingEmails?: boolean;
  emailSmtpHost?: string | null;
  emailSmtpPort?: number | null;
  emailSmtpUser?: string | null;
  emailSmtpPass?: SecretFieldPatch;
  emailFromAddress?: string | null;
  storageProvider?: StorageProvider;
  s3Endpoint?: string | null;
  s3Region?: string | null;
  s3Bucket?: string | null;
  s3AccessKeyId?: SecretFieldPatch;
  s3SecretAccessKey?: SecretFieldPatch;
  s3ForcePathStyle?: boolean;
  s3PublicUrlBase?: string | null;
  securityCaptchaType?: CaptchaType;
  securityCaptchaEnabled?: boolean;
  securityCaptchaSiteKey?: string | null;
  securityCaptchaSecretKey?: SecretFieldPatch;
  appSupportTicketsEnabled?: boolean;
  appMaintenanceModeEnabled?: boolean;
  appMaintenanceMessage?: string;
  appDebugMode?: boolean;
  appGlobalBannerAnnouncementEnabled?: boolean;
  appGlobalBannerAnnouncementMessage?: string;
  billingCurrency?: string;
  billingLocale?: string;
  billingTimezone?: string;
  billingInvoicePrefix?: string;
  billingInvoiceDueDays?: number;
  billingTaxEnabled?: boolean;
  billingTaxInclusive?: boolean;
  billingTaxRate?: number;
  billingTaxLabel?: string;
  billingCompanyName?: string;
  billingCompanyAddress?: string;
  billingSupportEmail?: string | null;
}
