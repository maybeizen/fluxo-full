import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsSecurityTab({ model }: { model: AdminSettingsModel }) {
  const {
    AdminSettingsSecretField,
    AdminSettingsToggle,
    Field,
    FieldGroup,
    FieldLabel,
    Input,
    NativeSelect,
  } = useUI();
  const t = useT();
  return (
    <FieldGroup>
      <AdminSettingsToggle
        id="settings-captcha-enabled"
        label={t("admin.settings.captchaEnabled")}
        checked={model.securityCaptchaEnabled}
        onChange={model.setSecurityCaptchaEnabled}
      />
      <Field>
        <FieldLabel htmlFor="settings-captcha-type">{t("admin.settings.captchaType")}</FieldLabel>
        <NativeSelect
          id="settings-captcha-type"
          value={model.securityCaptchaType}
          onChange={(event) =>
            model.setSecurityCaptchaType(
              event.target.value as "none" | "recaptcha" | "hcaptcha" | "turnstile",
            )
          }
        >
          <option value="none">{t("admin.settings.captchaNone")}</option>
          <option value="recaptcha">reCAPTCHA</option>
          <option value="hcaptcha">hCaptcha</option>
          <option value="turnstile">Turnstile</option>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-captcha-site">{t("admin.settings.captchaSiteKey")}</FieldLabel>
        <Input
          id="settings-captcha-site"
          value={model.securityCaptchaSiteKey}
          onChange={(event) => model.setSecurityCaptchaSiteKey(event.target.value)}
        />
      </Field>
      <AdminSettingsSecretField
        id="settings-captcha-secret"
        label={t("admin.settings.captchaSecret")}
        set={model.settings?.securityCaptchaSecretKeySet ?? false}
        draft={model.securityCaptchaSecretKey}
        onDraft={model.setSecurityCaptchaSecretKey}
      />
    </FieldGroup>
  );
}
