import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsAuthenticationTab({ model }: { model: AdminSettingsModel }) {
  const { AdminSettingsToggle, FieldGroup } = useUI();
  const t = useT();
  return (
    <FieldGroup>
      <AdminSettingsToggle
        id="settings-auth-register"
        label={t("admin.settings.disableRegistration")}
        checked={model.authDisableRegistration}
        onChange={model.setAuthDisableRegistration}
      />
      <AdminSettingsToggle
        id="settings-auth-login"
        label={t("admin.settings.disableLogin")}
        description={t("admin.settings.disableLoginHelp")}
        checked={model.authDisableLogin}
        onChange={model.setAuthDisableLogin}
      />
      <AdminSettingsToggle
        id="settings-auth-password"
        label={t("admin.settings.disablePasswordChange")}
        checked={model.authDisablePasswordChange}
        onChange={model.setAuthDisablePasswordChange}
      />
      <AdminSettingsToggle
        id="settings-auth-mfa"
        label={t("admin.settings.disableMfa")}
        checked={model.authDisableMfa}
        onChange={model.setAuthDisableMfa}
      />
      <AdminSettingsToggle
        id="settings-auth-verify"
        label={t("admin.settings.disableEmailVerification")}
        checked={model.authDisableEmailVerificationRequirement}
        onChange={model.setAuthDisableEmailVerificationRequirement}
      />
      <AdminSettingsToggle
        id="settings-auth-stop-mail"
        label={t("admin.settings.stopOutgoingEmails")}
        description={t("admin.settings.stopOutgoingEmailsHelp")}
        checked={model.authStopOutgoingEmails}
        onChange={model.setAuthStopOutgoingEmails}
      />
    </FieldGroup>
  );
}
