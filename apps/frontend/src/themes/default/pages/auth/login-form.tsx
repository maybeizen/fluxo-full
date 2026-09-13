import { Link } from "@tanstack/react-router";
import { CaptchaField } from "@/features/auth/captcha-field";
import type { LoginFormModel } from "@/hooks/use-login";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function LoginForm({
  username,
  setUsername,
  password,
  setPassword,
  remember,
  setRemember,
  captchaEnabled,
  captchaType,
  captchaSiteKey,
  setCaptchaToken,
  loginDisabled,
  errors,
  pending,
  passkeyPending,
  onSubmit,
  onPasskey,
}: LoginFormModel) {
  const {
    AuthCard,
    AuthSocialActions,
    Button,
    Checkbox,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
  } = useUI();

  return (
    <AuthCard
      title={t("auth.login.title")}
      description={t("auth.login.description")}
      footer={
        <p className="text-sm text-muted-foreground">
          {t("auth.login.footerPrefix")}{" "}
          <Button variant="link" nativeButton={false} render={<Link to="/register" />}>
            {t("auth.login.createAccount")}
          </Button>
        </p>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup>
          {loginDisabled ? <FieldError>{t("auth.login.disabled")}</FieldError> : null}
          {errors.form ? <FieldError>{errors.form}</FieldError> : null}
          <Field data-invalid={Boolean(errors.username) || undefined}>
            <FieldLabel htmlFor="login-username">{t("auth.login.username")}</FieldLabel>
            <Input
              id="login-username"
              name="username"
              autoComplete="username"
              value={username}
              aria-invalid={Boolean(errors.username) || undefined}
              onChange={(event) => setUsername(event.target.value)}
            />
            {errors.username ? <FieldError>{errors.username}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.password) || undefined}>
            <FieldLabel htmlFor="login-password">{t("auth.login.password")}</FieldLabel>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(errors.password) || undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors.password ? <FieldError>{errors.password}</FieldError> : null}
          </Field>
          <div className="flex items-center justify-between gap-3">
            <Field orientation="horizontal">
              <Checkbox
                id="login-remember"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <FieldLabel htmlFor="login-remember" className="font-normal">
                {t("auth.login.remember")}
              </FieldLabel>
            </Field>
            <Button variant="link" nativeButton={false} render={<Link to="/forgot-password" />}>
              {t("auth.login.forgot")}
            </Button>
          </div>
          {captchaEnabled ? (
            <>
              <CaptchaField
                type={captchaType}
                siteKey={captchaSiteKey}
                onToken={setCaptchaToken}
              />
              {errors.captcha ? <FieldError>{errors.captcha}</FieldError> : null}
            </>
          ) : null}
          <Field>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? t("auth.login.submitting") : t("auth.login.submit")}
            </Button>
          </Field>
          <AuthSocialActions passkeyPending={passkeyPending} onPasskey={onPasskey} />
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
