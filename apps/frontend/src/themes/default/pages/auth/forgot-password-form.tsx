import { Link } from "@tanstack/react-router";
import { CaptchaField } from "@/features/auth/captcha-field";
import type { ForgotPasswordFormModel } from "@/hooks/use-forgot-password";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function ForgotPasswordForm({
  email,
  setEmail,
  captchaEnabled,
  captchaType,
  captchaSiteKey,
  setCaptchaToken,
  error,
  sent,
  pending,
  onSubmit,
}: ForgotPasswordFormModel) {
  const { AuthCard, Button, Field, FieldDescription, FieldError, FieldGroup, FieldLabel, Input } =
    useUI();

  if (sent) {
    return (
      <AuthCard
        title={t("auth.forgot.sentTitle")}
        description={t("auth.forgot.sentDescription")}
        footer={
          <Button variant="link" nativeButton={false} render={<Link to="/login" />}>
            {t("auth.forgot.back")}
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t("auth.forgot.sentPrefix")}{" "}
          <span className="text-foreground">{email}</span>
          {t("auth.forgot.sentSuffix")}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("auth.forgot.title")}
      description={t("auth.forgot.description")}
      footer={
        <Button variant="link" nativeButton={false} render={<Link to="/login" />}>
          {t("auth.forgot.back")}
        </Button>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="forgot-email">{t("auth.forgot.email")}</FieldLabel>
            <Input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            <FieldDescription>{t("auth.forgot.emailHelp")}</FieldDescription>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          {captchaEnabled ? (
            <CaptchaField
              type={captchaType}
              siteKey={captchaSiteKey}
              onToken={setCaptchaToken}
            />
          ) : null}
          <Field>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? t("auth.forgot.sending") : t("auth.forgot.submit")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
