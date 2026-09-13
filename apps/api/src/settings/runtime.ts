import path from "node:path";
import type { FluxoLogger } from "@fluxo/logger";
import { createStorage, type StorageDriver } from "@fluxo/s3";
import type {
  AppSettingsAdmin,
  AppSettingsAdminResponse,
  AppSettingsPatch,
  AppSettingsPublic,
  StorageConfig,
} from "@fluxo/types";
import { FLUXO_THEME_CATALOG } from "@fluxo/types";
import type { AuthConfig } from "../auth/stores/types.js";
import type { CaptchaVerifier } from "./captcha.js";
import { createCaptchaVerifier } from "./captcha.js";
import {
  seedFromEnv,
  toAdminSettings,
  toPublicSettings,
  type ResolvedSettings,
  type SettingsEnvSeed,
} from "./defaults.js";
import type { Mailer, MailMessage } from "./mailer.js";
import { createSmtpMailer } from "./mailer.js";
import { parsePersisted, serializePersisted } from "./persist.js";
import { applySecretPatch } from "./secrets.js";
import type { SettingsStore } from "./store.js";
import { createMemorySettingsStore } from "./store.js";

export type CaptchaCheck = "ok" | "required" | "invalid";

export interface SettingsRuntime {
  current(): ResolvedSettings;
  publicView(): AppSettingsPublic;
  adminView(): AppSettingsAdmin;
  adminResponse(): AppSettingsAdminResponse;
  patch(input: AppSettingsPatch): Promise<AppSettingsAdminResponse>;
  setAppIconKey(key: string | null, revision?: string | null): Promise<AppSettingsAdminResponse>;
  storage: StorageDriver;
  sendMail(message: MailMessage): Promise<boolean>;
  verifyCaptcha(token: string | undefined): Promise<CaptchaCheck>;
}

function blankToNull(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) {
    return fallback;
  }
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return value;
}

function applyPatch(current: ResolvedSettings, input: AppSettingsPatch): ResolvedSettings {
  const next: ResolvedSettings = { ...current };
  if (input.appName !== undefined) {
    next.appName = input.appName;
  }
  if (input.appBaseUrl !== undefined) {
    next.appBaseUrl = input.appBaseUrl.replace(/\/$/, "");
  }
  if (input.activeThemeId !== undefined) {
    next.activeThemeId = input.activeThemeId;
  }
  if (input.authDisableEmailVerificationRequirement !== undefined) {
    next.authDisableEmailVerificationRequirement = input.authDisableEmailVerificationRequirement;
  }
  if (input.authDisableRegistration !== undefined) {
    next.authDisableRegistration = input.authDisableRegistration;
  }
  if (input.authDisableLogin !== undefined) {
    next.authDisableLogin = input.authDisableLogin;
  }
  if (input.authDisablePasswordChange !== undefined) {
    next.authDisablePasswordChange = input.authDisablePasswordChange;
  }
  if (input.authDisableMfa !== undefined) {
    next.authDisableMfa = input.authDisableMfa;
  }
  if (input.authStopOutgoingEmails !== undefined) {
    next.authStopOutgoingEmails = input.authStopOutgoingEmails;
  }
  if (input.emailSmtpHost !== undefined) {
    next.emailSmtpHost = blankToNull(input.emailSmtpHost, current.emailSmtpHost);
  }
  if (input.emailSmtpPort !== undefined) {
    next.emailSmtpPort = input.emailSmtpPort;
  }
  if (input.emailSmtpUser !== undefined) {
    next.emailSmtpUser = blankToNull(input.emailSmtpUser, current.emailSmtpUser);
  }
  next.emailSmtpPass = applySecretPatch(current.emailSmtpPass, input.emailSmtpPass);
  if (input.emailFromAddress !== undefined) {
    next.emailFromAddress = blankToNull(input.emailFromAddress, current.emailFromAddress);
  }
  if (input.storageProvider !== undefined) {
    next.storageProvider = input.storageProvider;
  }
  if (input.s3Endpoint !== undefined) {
    next.s3Endpoint = blankToNull(input.s3Endpoint, current.s3Endpoint);
  }
  if (input.s3Region !== undefined) {
    next.s3Region = blankToNull(input.s3Region, current.s3Region);
  }
  if (input.s3Bucket !== undefined) {
    next.s3Bucket = blankToNull(input.s3Bucket, current.s3Bucket);
  }
  next.s3AccessKeyId = applySecretPatch(current.s3AccessKeyId, input.s3AccessKeyId);
  next.s3SecretAccessKey = applySecretPatch(current.s3SecretAccessKey, input.s3SecretAccessKey);
  if (input.s3ForcePathStyle !== undefined) {
    next.s3ForcePathStyle = input.s3ForcePathStyle;
  }
  if (input.s3PublicUrlBase !== undefined) {
    next.s3PublicUrlBase = blankToNull(input.s3PublicUrlBase, current.s3PublicUrlBase);
  }
  if (input.securityCaptchaType !== undefined) {
    next.securityCaptchaType = input.securityCaptchaType;
  }
  if (input.securityCaptchaEnabled !== undefined) {
    next.securityCaptchaEnabled = input.securityCaptchaEnabled;
  }
  if (input.securityCaptchaSiteKey !== undefined) {
    next.securityCaptchaSiteKey = blankToNull(
      input.securityCaptchaSiteKey,
      current.securityCaptchaSiteKey,
    );
  }
  next.securityCaptchaSecretKey = applySecretPatch(
    current.securityCaptchaSecretKey,
    input.securityCaptchaSecretKey,
  );
  if (input.appSupportTicketsEnabled !== undefined) {
    next.appSupportTicketsEnabled = input.appSupportTicketsEnabled;
  }
  if (input.appMaintenanceModeEnabled !== undefined) {
    next.appMaintenanceModeEnabled = input.appMaintenanceModeEnabled;
  }
  if (input.appMaintenanceMessage !== undefined) {
    next.appMaintenanceMessage = input.appMaintenanceMessage;
  }
  if (input.appDebugMode !== undefined) {
    next.appDebugMode = input.appDebugMode;
  }
  if (input.appGlobalBannerAnnouncementEnabled !== undefined) {
    next.appGlobalBannerAnnouncementEnabled = input.appGlobalBannerAnnouncementEnabled;
  }
  if (input.appGlobalBannerAnnouncementMessage !== undefined) {
    next.appGlobalBannerAnnouncementMessage = input.appGlobalBannerAnnouncementMessage;
  }
  if (input.billingCurrency !== undefined) {
    next.billingCurrency = input.billingCurrency.toUpperCase();
  }
  if (input.billingLocale !== undefined) {
    next.billingLocale = input.billingLocale;
  }
  if (input.billingTimezone !== undefined) {
    next.billingTimezone = input.billingTimezone;
  }
  if (input.billingInvoicePrefix !== undefined) {
    next.billingInvoicePrefix = input.billingInvoicePrefix;
  }
  if (input.billingInvoiceDueDays !== undefined) {
    next.billingInvoiceDueDays = input.billingInvoiceDueDays;
  }
  if (input.billingTaxEnabled !== undefined) {
    next.billingTaxEnabled = input.billingTaxEnabled;
  }
  if (input.billingTaxInclusive !== undefined) {
    next.billingTaxInclusive = input.billingTaxInclusive;
  }
  if (input.billingTaxRate !== undefined) {
    next.billingTaxRate = input.billingTaxRate;
  }
  if (input.billingTaxLabel !== undefined) {
    next.billingTaxLabel = input.billingTaxLabel;
  }
  if (input.billingCompanyName !== undefined) {
    next.billingCompanyName = input.billingCompanyName;
  }
  if (input.billingCompanyAddress !== undefined) {
    next.billingCompanyAddress = input.billingCompanyAddress;
  }
  if (input.billingSupportEmail !== undefined) {
    next.billingSupportEmail =
      input.billingSupportEmail === "" ? null : input.billingSupportEmail;
  }
  return next;
}

export function assertStorageReady(settings: ResolvedSettings): string | null {
  if (settings.storageProvider !== "s3") {
    return null;
  }
  if (!settings.s3Bucket || !settings.s3Region || !settings.s3AccessKeyId || !settings.s3SecretAccessKey) {
    return "s3_incomplete";
  }
  return null;
}

function storageConfigFrom(settings: ResolvedSettings): StorageConfig {
  if (settings.storageProvider === "s3") {
    return {
      s3: {
        bucket: settings.s3Bucket ?? "",
        region: settings.s3Region ?? "",
        accessKeyId: settings.s3AccessKeyId ?? undefined,
        secretAccessKey: settings.s3SecretAccessKey ?? undefined,
        endpoint: settings.s3Endpoint ?? undefined,
        forcePathStyle: settings.s3ForcePathStyle,
        publicUrlBase: settings.s3PublicUrlBase ?? undefined,
      },
    };
  }
  return { local: { directory: path.join(process.cwd(), "storage") } };
}

function syncAuthConfig(config: AuthConfig | undefined, settings: ResolvedSettings): void {
  if (!config) {
    return;
  }
  config.appName = settings.appName;
  config.frontendUrl = settings.appBaseUrl;
  config.storagePublicUrlBase = settings.s3PublicUrlBase ?? undefined;
}

export function createSettingsRuntime(options: {
  store: SettingsStore;
  env: SettingsEnvSeed;
  initial?: string | null;
  mailer?: Mailer;
  captchaVerifier?: CaptchaVerifier;
  authConfig?: AuthConfig;
  logger?: FluxoLogger;
  storage?: StorageDriver;
}): SettingsRuntime {
  const seed = seedFromEnv(options.env);
  let resolved =
    options.initial === undefined || options.initial === null
      ? seed
      : parsePersisted(options.initial, seed, options.env.appKey);
  let driver = options.storage ?? createStorage(storageConfigFrom(resolved));
  const mailer = options.mailer ?? createSmtpMailer();
  const captchaVerifier = options.captchaVerifier ?? createCaptchaVerifier();
  syncAuthConfig(options.authConfig, resolved);

  function rebuildStorage(): void {
    if (options.storage) {
      return;
    }
    driver = createStorage(storageConfigFrom(resolved));
  }

  function views(): AppSettingsAdminResponse {
    return {
      settings: toAdminSettings(resolved, options.env.apiUrl),
      themes: FLUXO_THEME_CATALOG,
    };
  }

  async function persist(): Promise<AppSettingsAdminResponse> {
    await options.store.save(serializePersisted(resolved, options.env.appKey));
    rebuildStorage();
    syncAuthConfig(options.authConfig, resolved);
    return views();
  }

  const storage: StorageDriver = {
    put: (key, body, contentType) => driver.put(key, body, contentType),
    get: (key) => driver.get(key),
    delete: (key) => driver.delete(key),
  };

  return {
    current() {
      return resolved;
    },
    publicView() {
      return toPublicSettings(resolved, options.env.apiUrl);
    },
    adminView() {
      return toAdminSettings(resolved, options.env.apiUrl);
    },
    adminResponse() {
      return views();
    },
    async patch(input) {
      const next = applyPatch(resolved, input);
      const storageError = assertStorageReady(next);
      if (storageError) {
        throw new SettingsValidationError(storageError);
      }
      resolved = next;
      return persist();
    },
    async setAppIconKey(key, revision = null) {
      resolved = {
        ...resolved,
        appIconKey: key,
        appIconRevision: key ? revision : null,
      };
      return persist();
    },
    storage,
    async sendMail(message) {
      if (resolved.authStopOutgoingEmails) {
        options.logger?.info("mail.blocked", { reason: "authStopOutgoingEmails" });
        return false;
      }
      if (!resolved.emailSmtpHost) {
        options.logger?.info("mail.skipped", { reason: "smtp_unconfigured" });
        return false;
      }
      await mailer.send(message, {
        host: resolved.emailSmtpHost,
        port: resolved.emailSmtpPort ?? 587,
        user: resolved.emailSmtpUser ?? undefined,
        pass: resolved.emailSmtpPass ?? undefined,
        from: resolved.emailFromAddress ?? undefined,
      });
      return true;
    },
    async verifyCaptcha(token) {
      if (!resolved.securityCaptchaEnabled || resolved.securityCaptchaType === "none") {
        return "ok";
      }
      if (!token || token.trim().length === 0) {
        return "required";
      }
      if (!resolved.securityCaptchaSecretKey) {
        return "invalid";
      }
      const ok = await captchaVerifier({
        type: resolved.securityCaptchaType,
        secret: resolved.securityCaptchaSecretKey,
        token,
      });
      return ok ? "ok" : "invalid";
    },
  };
}

export class SettingsValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function loadSettingsRuntime(options: {
  store: SettingsStore;
  env: SettingsEnvSeed;
  mailer?: Mailer;
  captchaVerifier?: CaptchaVerifier;
  authConfig?: AuthConfig;
  logger?: FluxoLogger;
}): Promise<SettingsRuntime> {
  const initial = await options.store.load();
  return createSettingsRuntime({ ...options, initial });
}

export function createMemorySettingsRuntime(
  env: SettingsEnvSeed,
  extras?: {
    mailer?: Mailer;
    captchaVerifier?: CaptchaVerifier;
    authConfig?: AuthConfig;
    logger?: FluxoLogger;
    storage?: StorageDriver;
  },
): SettingsRuntime {
  return createSettingsRuntime({
    store: createMemorySettingsStore(),
    env,
    ...extras,
  });
}
