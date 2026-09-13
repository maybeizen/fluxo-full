import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsSmtpTab({ model }: { model: AdminSettingsModel }) {
  const { AdminSettingsSecretField, Field, FieldGroup, FieldLabel, Input } = useUI();
  const t = useT();
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="settings-smtp-host">{t("admin.settings.smtpHost")}</FieldLabel>
        <Input
          id="settings-smtp-host"
          value={model.emailSmtpHost}
          onChange={(event) => model.setEmailSmtpHost(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-smtp-port">{t("admin.settings.smtpPort")}</FieldLabel>
        <Input
          id="settings-smtp-port"
          inputMode="numeric"
          value={model.emailSmtpPort}
          onChange={(event) => model.setEmailSmtpPort(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-smtp-user">{t("admin.settings.smtpUser")}</FieldLabel>
        <Input
          id="settings-smtp-user"
          value={model.emailSmtpUser}
          onChange={(event) => model.setEmailSmtpUser(event.target.value)}
        />
      </Field>
      <AdminSettingsSecretField
        id="settings-smtp-pass"
        label={t("admin.settings.smtpPass")}
        set={model.settings?.emailSmtpPassSet ?? false}
        draft={model.emailSmtpPass}
        onDraft={model.setEmailSmtpPass}
      />
      <Field>
        <FieldLabel htmlFor="settings-smtp-from">{t("admin.settings.emailFrom")}</FieldLabel>
        <Input
          id="settings-smtp-from"
          value={model.emailFromAddress}
          onChange={(event) => model.setEmailFromAddress(event.target.value)}
        />
      </Field>
    </FieldGroup>
  );
}
