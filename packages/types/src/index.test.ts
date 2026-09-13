import { describe, expect, it } from "vitest";
import {
  AuthTokenType,
  CAPTCHA_TYPES,
  FLUXO_THEME_CATALOG,
  FLUXO_THEME_IDS,
  isFluxoThemeId,
  LogLevel,
  PluginStatus,
  STORAGE_PROVIDERS,
  UserRole,
} from "./index.js";
import type {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListResponse,
  AppSettingsAdmin,
  AppSettingsAdminResponse,
  AppSettingsPatch,
  AppSettingsPublic,
  AuthMeResponse,
  LoginResponse,
  PublicUser,
  SessionUser,
} from "./index.js";

describe("types", () => {
  it("exposes log levels", () => {
    expect(LogLevel.Debug).toBe("debug");
    expect(LogLevel.Info).toBe("info");
    expect(LogLevel.Warn).toBe("warn");
    expect(LogLevel.Error).toBe("error");
  });

  it("exposes plugin statuses", () => {
    expect(PluginStatus.Loaded).toBe("loaded");
    expect(PluginStatus.Enabled).toBe("enabled");
    expect(PluginStatus.Disabled).toBe("disabled");
    expect(PluginStatus.Error).toBe("error");
  });

  it("exposes auth roles and token types", () => {
    expect(UserRole.User).toBe("user");
    expect(UserRole.Admin).toBe("admin");
    expect(AuthTokenType.EmailConfirm).toBe("email_confirm");
    expect(AuthTokenType.PasswordReset).toBe("password_reset");
  });

  it("describes locked public auth contracts", () => {
    const user: PublicUser = {
      id: "00000000-0000-4000-8000-000000000001",
      username: "ada",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      avatarSource: "none",
      dateOfBirth: null,
      company: null,
      role: UserRole.Admin,
      emailVerified: true,
      mfaEnabled: false,
      hasPasskey: false,
      suspended: false,
      suspendedReason: null,
      createdAt: "2026-09-13T03:11:00.000Z",
    };
    const adminListItem: AdminUserListItem = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      hasPasskey: user.hasPasskey,
      createdAt: "2026-09-13T03:11:00.000Z",
      suspended: false,
    };
    const adminDetail: AdminUserDetail = {
      ...user,
      passkeys: [],
      createdAt: "2026-09-13T03:11:00Z",
      lastActiveAt: null,
      suspendedAt: null,
    };
    const adminList: AdminUserListResponse = { users: [adminListItem] };
    const me: AuthMeResponse = { user };
    const session: SessionUser = { ...user, mfaVerified: true };
    const login: LoginResponse = { user };
    const challenge: LoginResponse = { requiresMfa: true };

    expect(me.user.role).toBe(UserRole.Admin);
    expect(me.user.suspended).toBe(false);
    expect(adminList.users).toHaveLength(1);
    expect(adminDetail.suspendedAt).toBeNull();
    expect(session.mfaVerified).toBe(true);
    expect("requiresMfa" in login ? login.requiresMfa : false).toBeFalsy();
    expect(challenge.requiresMfa).toBe(true);
  });

  it("locks the theme catalog and settings contract", () => {
    expect(FLUXO_THEME_IDS).toEqual(["default", "example"]);
    expect(isFluxoThemeId("default")).toBe(true);
    expect(isFluxoThemeId("unknown")).toBe(false);
    expect(STORAGE_PROVIDERS).toEqual(["local", "s3"]);
    expect(CAPTCHA_TYPES).toEqual(["none", "recaptcha", "hcaptcha", "turnstile"]);
    expect(FLUXO_THEME_CATALOG.map((theme) => theme.id)).toEqual(["default", "example"]);

    const publicSettings: AppSettingsPublic = {
      appName: "Fluxo",
      appBaseUrl: "http://localhost:5173",
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
    const admin: AppSettingsAdmin = {
      ...publicSettings,
      authDisableEmailVerificationRequirement: false,
      authDisablePasswordChange: false,
      authDisableMfa: false,
      authStopOutgoingEmails: false,
      emailSmtpHost: null,
      emailSmtpPort: null,
      emailSmtpUser: null,
      emailSmtpPassSet: false,
      emailFromAddress: null,
      storageProvider: "local",
      s3Endpoint: null,
      s3Region: null,
      s3Bucket: null,
      s3AccessKeyIdSet: false,
      s3SecretAccessKeySet: false,
      s3ForcePathStyle: true,
      s3PublicUrlBase: null,
      securityCaptchaSecretKeySet: false,
      appDebugMode: false,
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
    const response: AppSettingsAdminResponse = {
      settings: admin,
      themes: FLUXO_THEME_CATALOG,
    };
    const patch: AppSettingsPatch = {
      emailSmtpPass: null,
      s3AccessKeyId: "key",
      s3SecretAccessKey: "",
      securityCaptchaSecretKey: undefined,
      activeThemeId: "example",
    };

    expect(admin.emailSmtpPassSet).toBe(false);
    expect(response.themes).toHaveLength(2);
    expect(patch.emailSmtpPass).toBeNull();
    expect(Object.hasOwn(publicSettings, "emailSmtpPass")).toBe(false);
    expect(Object.hasOwn(publicSettings, "s3SecretAccessKey")).toBe(false);
    expect(Object.hasOwn(publicSettings, "securityCaptchaSecretKey")).toBe(false);
  });
});
