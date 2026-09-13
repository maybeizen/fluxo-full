import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppSettingsAdmin, AppSettingsPatch, FluxoThemeId } from "@fluxo/types";
import {
  adminSettingsQueryKey,
  deleteAppIcon,
  getAdminSettings,
  patchAdminSettings,
  uploadAppIcon,
} from "@/features/admin/settings/api";
import { AuthApiError } from "@/lib/auth";
import { publicSettingsQueryKey } from "@/lib/public-settings";
import { t } from "@/theme-system/use-t";

export type AdminSettingsSecretDraft = { value: string; clear: boolean };

type SecretDraft = AdminSettingsSecretDraft;

function emptySecret(): SecretDraft {
  return { value: "", clear: false };
}

function secretPatch(draft: SecretDraft): string | null | undefined {
  if (draft.clear) {
    return null;
  }
  if (draft.value.length === 0) {
    return undefined;
  }
  return draft.value;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function useAdminSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: adminSettingsQueryKey,
    queryFn: getAdminSettings,
  });
  const settings = query.data?.settings;
  const themes = query.data?.themes ?? [];

  const [appName, setAppName] = useState("");
  const [appBaseUrl, setAppBaseUrl] = useState("");
  const [activeThemeId, setActiveThemeId] = useState<FluxoThemeId>("default");
  const [authDisableEmailVerificationRequirement, setAuthDisableEmailVerificationRequirement] =
    useState(false);
  const [authDisableRegistration, setAuthDisableRegistration] = useState(false);
  const [authDisableLogin, setAuthDisableLogin] = useState(false);
  const [authDisablePasswordChange, setAuthDisablePasswordChange] = useState(false);
  const [authDisableMfa, setAuthDisableMfa] = useState(false);
  const [authStopOutgoingEmails, setAuthStopOutgoingEmails] = useState(false);
  const [emailSmtpHost, setEmailSmtpHost] = useState("");
  const [emailSmtpPort, setEmailSmtpPort] = useState("");
  const [emailSmtpUser, setEmailSmtpUser] = useState("");
  const [emailSmtpPass, setEmailSmtpPass] = useState<SecretDraft>(emptySecret);
  const [emailFromAddress, setEmailFromAddress] = useState("");
  const [storageProvider, setStorageProvider] = useState<"local" | "s3">("local");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Region, setS3Region] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3AccessKeyId, setS3AccessKeyId] = useState<SecretDraft>(emptySecret);
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState<SecretDraft>(emptySecret);
  const [s3ForcePathStyle, setS3ForcePathStyle] = useState(true);
  const [s3PublicUrlBase, setS3PublicUrlBase] = useState("");
  const [securityCaptchaType, setSecurityCaptchaType] = useState<
    "none" | "recaptcha" | "hcaptcha" | "turnstile"
  >("none");
  const [securityCaptchaEnabled, setSecurityCaptchaEnabled] = useState(false);
  const [securityCaptchaSiteKey, setSecurityCaptchaSiteKey] = useState("");
  const [securityCaptchaSecretKey, setSecurityCaptchaSecretKey] = useState<SecretDraft>(emptySecret);
  const [appSupportTicketsEnabled, setAppSupportTicketsEnabled] = useState(true);
  const [appMaintenanceModeEnabled, setAppMaintenanceModeEnabled] = useState(false);
  const [appMaintenanceMessage, setAppMaintenanceMessage] = useState("");
  const [appDebugMode, setAppDebugMode] = useState(false);
  const [appGlobalBannerAnnouncementEnabled, setAppGlobalBannerAnnouncementEnabled] =
    useState(false);
  const [appGlobalBannerAnnouncementMessage, setAppGlobalBannerAnnouncementMessage] = useState("");
  const [billingCurrency, setBillingCurrency] = useState("USD");
  const [billingLocale, setBillingLocale] = useState("en-US");
  const [billingTimezone, setBillingTimezone] = useState("UTC");
  const [billingInvoicePrefix, setBillingInvoicePrefix] = useState("INV");
  const [billingInvoiceDueDays, setBillingInvoiceDueDays] = useState("14");
  const [billingTaxEnabled, setBillingTaxEnabled] = useState(false);
  const [billingTaxInclusive, setBillingTaxInclusive] = useState(false);
  const [billingTaxRate, setBillingTaxRate] = useState("0");
  const [billingTaxLabel, setBillingTaxLabel] = useState("Tax");
  const [billingCompanyName, setBillingCompanyName] = useState("");
  const [billingCompanyAddress, setBillingCompanyAddress] = useState("");
  const [billingSupportEmail, setBillingSupportEmail] = useState("");
  const [formError, setFormError] = useState<string | undefined>();

  useEffect(() => {
    if (!settings) {
      return;
    }
    hydrate(settings);
    setFormError(undefined);
  }, [settings]);

  function hydrate(next: AppSettingsAdmin): void {
    setAppName(next.appName);
    setAppBaseUrl(next.appBaseUrl);
    setActiveThemeId(next.activeThemeId);
    setAuthDisableEmailVerificationRequirement(next.authDisableEmailVerificationRequirement);
    setAuthDisableRegistration(next.authDisableRegistration);
    setAuthDisableLogin(next.authDisableLogin);
    setAuthDisablePasswordChange(next.authDisablePasswordChange);
    setAuthDisableMfa(next.authDisableMfa);
    setAuthStopOutgoingEmails(next.authStopOutgoingEmails);
    setEmailSmtpHost(next.emailSmtpHost ?? "");
    setEmailSmtpPort(next.emailSmtpPort === null ? "" : String(next.emailSmtpPort));
    setEmailSmtpUser(next.emailSmtpUser ?? "");
    setEmailSmtpPass(emptySecret());
    setEmailFromAddress(next.emailFromAddress ?? "");
    setStorageProvider(next.storageProvider);
    setS3Endpoint(next.s3Endpoint ?? "");
    setS3Region(next.s3Region ?? "");
    setS3Bucket(next.s3Bucket ?? "");
    setS3AccessKeyId(emptySecret());
    setS3SecretAccessKey(emptySecret());
    setS3ForcePathStyle(next.s3ForcePathStyle);
    setS3PublicUrlBase(next.s3PublicUrlBase ?? "");
    setSecurityCaptchaType(next.securityCaptchaType);
    setSecurityCaptchaEnabled(next.securityCaptchaEnabled);
    setSecurityCaptchaSiteKey(next.securityCaptchaSiteKey ?? "");
    setSecurityCaptchaSecretKey(emptySecret());
    setAppSupportTicketsEnabled(next.appSupportTicketsEnabled);
    setAppMaintenanceModeEnabled(next.appMaintenanceModeEnabled);
    setAppMaintenanceMessage(next.appMaintenanceMessage);
    setAppDebugMode(next.appDebugMode);
    setAppGlobalBannerAnnouncementEnabled(next.appGlobalBannerAnnouncementEnabled);
    setAppGlobalBannerAnnouncementMessage(next.appGlobalBannerAnnouncementMessage);
    setBillingCurrency(next.billingCurrency);
    setBillingLocale(next.billingLocale);
    setBillingTimezone(next.billingTimezone);
    setBillingInvoicePrefix(next.billingInvoicePrefix);
    setBillingInvoiceDueDays(String(next.billingInvoiceDueDays));
    setBillingTaxEnabled(next.billingTaxEnabled);
    setBillingTaxInclusive(next.billingTaxInclusive);
    setBillingTaxRate(String(next.billingTaxRate));
    setBillingTaxLabel(next.billingTaxLabel);
    setBillingCompanyName(next.billingCompanyName);
    setBillingCompanyAddress(next.billingCompanyAddress);
    setBillingSupportEmail(next.billingSupportEmail ?? "");
  }

  function buildPatch(): AppSettingsPatch {
    const port = emailSmtpPort.trim();
    const dueDays = Number.parseInt(billingInvoiceDueDays, 10);
    const taxRate = Number.parseFloat(billingTaxRate);
    return {
      appName: appName.trim(),
      appBaseUrl: appBaseUrl.trim(),
      activeThemeId,
      authDisableEmailVerificationRequirement,
      authDisableRegistration,
      authDisableLogin,
      authDisablePasswordChange,
      authDisableMfa,
      authStopOutgoingEmails,
      emailSmtpHost: emptyToNull(emailSmtpHost),
      emailSmtpPort: port.length === 0 ? null : Number.parseInt(port, 10),
      emailSmtpUser: emptyToNull(emailSmtpUser),
      emailSmtpPass: secretPatch(emailSmtpPass),
      emailFromAddress: emptyToNull(emailFromAddress),
      storageProvider,
      s3Endpoint: emptyToNull(s3Endpoint),
      s3Region: emptyToNull(s3Region),
      s3Bucket: emptyToNull(s3Bucket),
      s3AccessKeyId: secretPatch(s3AccessKeyId),
      s3SecretAccessKey: secretPatch(s3SecretAccessKey),
      s3ForcePathStyle,
      s3PublicUrlBase: emptyToNull(s3PublicUrlBase),
      securityCaptchaType,
      securityCaptchaEnabled,
      securityCaptchaSiteKey: emptyToNull(securityCaptchaSiteKey),
      securityCaptchaSecretKey: secretPatch(securityCaptchaSecretKey),
      appSupportTicketsEnabled,
      appMaintenanceModeEnabled,
      appMaintenanceMessage,
      appDebugMode,
      appGlobalBannerAnnouncementEnabled,
      appGlobalBannerAnnouncementMessage,
      billingCurrency: billingCurrency.trim().toUpperCase(),
      billingLocale: billingLocale.trim(),
      billingTimezone: billingTimezone.trim(),
      billingInvoicePrefix: billingInvoicePrefix.trim(),
      billingInvoiceDueDays: Number.isFinite(dueDays) ? dueDays : 14,
      billingTaxEnabled,
      billingTaxInclusive,
      billingTaxRate: Number.isFinite(taxRate) ? taxRate : 0,
      billingTaxLabel: billingTaxLabel.trim(),
      billingCompanyName: billingCompanyName,
      billingCompanyAddress: billingCompanyAddress,
      billingSupportEmail: emptyToNull(billingSupportEmail),
    };
  }

  const saveMutation = useMutation({
    mutationFn: () => patchAdminSettings(buildPatch()),
    onSuccess: async (result) => {
      queryClient.setQueryData(adminSettingsQueryKey, result);
      await queryClient.invalidateQueries({ queryKey: publicSettingsQueryKey });
      toast.success(t("admin.settings.saved"));
      setFormError(undefined);
    },
    onError: (error) => {
      const message =
        error instanceof AuthApiError ? error.message : t("admin.settings.saveUnable");
      setFormError(message);
      toast.error(message);
    },
  });

  const iconMutation = useMutation({
    mutationFn: (file: File) => uploadAppIcon(file),
    onSuccess: async (result) => {
      queryClient.setQueryData(adminSettingsQueryKey, result);
      await queryClient.invalidateQueries({ queryKey: publicSettingsQueryKey });
      toast.success(t("admin.settings.iconUpdated"));
    },
    onError: (error) => {
      toast.error(error instanceof AuthApiError ? error.message : t("admin.settings.iconUnable"));
    },
  });

  const iconDeleteMutation = useMutation({
    mutationFn: deleteAppIcon,
    onSuccess: async (result) => {
      queryClient.setQueryData(adminSettingsQueryKey, result);
      await queryClient.invalidateQueries({ queryKey: publicSettingsQueryKey });
      toast.success(t("admin.settings.iconRemoved"));
    },
    onError: (error) => {
      toast.error(error instanceof AuthApiError ? error.message : t("admin.settings.iconRemoveUnable"));
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveMutation.mutate();
  }

  return {
    query,
    settings,
    themes,
    appName,
    setAppName,
    appBaseUrl,
    setAppBaseUrl,
    activeThemeId,
    setActiveThemeId,
    authDisableEmailVerificationRequirement,
    setAuthDisableEmailVerificationRequirement,
    authDisableRegistration,
    setAuthDisableRegistration,
    authDisableLogin,
    setAuthDisableLogin,
    authDisablePasswordChange,
    setAuthDisablePasswordChange,
    authDisableMfa,
    setAuthDisableMfa,
    authStopOutgoingEmails,
    setAuthStopOutgoingEmails,
    emailSmtpHost,
    setEmailSmtpHost,
    emailSmtpPort,
    setEmailSmtpPort,
    emailSmtpUser,
    setEmailSmtpUser,
    emailSmtpPass,
    setEmailSmtpPass,
    emailFromAddress,
    setEmailFromAddress,
    storageProvider,
    setStorageProvider,
    s3Endpoint,
    setS3Endpoint,
    s3Region,
    setS3Region,
    s3Bucket,
    setS3Bucket,
    s3AccessKeyId,
    setS3AccessKeyId,
    s3SecretAccessKey,
    setS3SecretAccessKey,
    s3ForcePathStyle,
    setS3ForcePathStyle,
    s3PublicUrlBase,
    setS3PublicUrlBase,
    securityCaptchaType,
    setSecurityCaptchaType,
    securityCaptchaEnabled,
    setSecurityCaptchaEnabled,
    securityCaptchaSiteKey,
    setSecurityCaptchaSiteKey,
    securityCaptchaSecretKey,
    setSecurityCaptchaSecretKey,
    appSupportTicketsEnabled,
    setAppSupportTicketsEnabled,
    appMaintenanceModeEnabled,
    setAppMaintenanceModeEnabled,
    appMaintenanceMessage,
    setAppMaintenanceMessage,
    appDebugMode,
    setAppDebugMode,
    appGlobalBannerAnnouncementEnabled,
    setAppGlobalBannerAnnouncementEnabled,
    appGlobalBannerAnnouncementMessage,
    setAppGlobalBannerAnnouncementMessage,
    billingCurrency,
    setBillingCurrency,
    billingLocale,
    setBillingLocale,
    billingTimezone,
    setBillingTimezone,
    billingInvoicePrefix,
    setBillingInvoicePrefix,
    billingInvoiceDueDays,
    setBillingInvoiceDueDays,
    billingTaxEnabled,
    setBillingTaxEnabled,
    billingTaxInclusive,
    setBillingTaxInclusive,
    billingTaxRate,
    setBillingTaxRate,
    billingTaxLabel,
    setBillingTaxLabel,
    billingCompanyName,
    setBillingCompanyName,
    billingCompanyAddress,
    setBillingCompanyAddress,
    billingSupportEmail,
    setBillingSupportEmail,
    formError,
    saving: saveMutation.isPending,
    iconBusy: iconMutation.isPending || iconDeleteMutation.isPending,
    onSubmit,
    onUploadIcon: (file: File) => iconMutation.mutate(file),
    onDeleteIcon: () => iconDeleteMutation.mutate(),
  };
}

export type AdminSettingsModel = ReturnType<typeof useAdminSettings>;
