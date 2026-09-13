import type { AppSettingsPublic } from "@fluxo/types";
import { z } from "zod";
import { getApiUrl } from "@/lib/api";

export const publicSettingsQueryKey = ["settings", "public"] as const;

export const DEFAULT_PUBLIC_SETTINGS: AppSettingsPublic = {
  appName: "Fluxo",
  appBaseUrl: "",
  appIconUrl: null,
  activeThemeId: "default",
  authDisableRegistration: false,
  authDisableLogin: false,
  securityCaptchaType: "none",
  securityCaptchaEnabled: false,
  securityCaptchaSiteKey: null,
  appSupportTicketsEnabled: true,
  appMaintenanceModeEnabled: false,
  appMaintenanceMessage: "",
  appGlobalBannerAnnouncementEnabled: false,
  appGlobalBannerAnnouncementMessage: "",
  billingCurrency: "USD",
  billingLocale: "en-US",
  billingTimezone: "UTC",
};

const themeIdSchema = z.enum(["default", "example"]);
const captchaTypeSchema = z.enum(["none", "recaptcha", "hcaptcha", "turnstile"]);

export const publicSettingsSchema: z.ZodType<AppSettingsPublic> = z.object({
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
});

export async function fetchPublicSettings(): Promise<AppSettingsPublic> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return DEFAULT_PUBLIC_SETTINGS;
  }

  try {
    const response = await fetch(`${apiUrl}/settings/public`, { credentials: "include" });
    if (!response.ok) {
      return DEFAULT_PUBLIC_SETTINGS;
    }
    const parsed = publicSettingsSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : DEFAULT_PUBLIC_SETTINGS;
  } catch {
    return DEFAULT_PUBLIC_SETTINGS;
  }
}
