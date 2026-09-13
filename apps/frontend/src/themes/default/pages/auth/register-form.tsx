import { Link } from "@tanstack/react-router";
import { CaptchaField } from "@/features/auth/captcha-field";
import type { RegisterFormModel } from "@/hooks/use-register";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function RegisterForm({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  username,
  setUsername,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  captchaEnabled,
  captchaType,
  captchaSiteKey,
  setCaptchaToken,
  registrationDisabled,
  errors,
  pending,
  onSubmit,
}: RegisterFormModel) {
  const { AuthCard, Button, Field, FieldError, FieldGroup, FieldLabel, Input } = useUI();

  return (
    <AuthCard
      title={t("auth.register.title")}
      description={t("auth.register.description")}
      footer={
        <p className="text-sm text-muted-foreground">
          {t("auth.register.footerPrefix")}{" "}
          <Button variant="link" nativeButton={false} render={<Link to="/login" />}>
            {t("auth.register.signIn")}
          </Button>
        </p>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup>
          {registrationDisabled ? <FieldError>{t("auth.register.disabled")}</FieldError> : null}
          {errors.form ? <FieldError>{errors.form}</FieldError> : null}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.firstName) || undefined}>
              <FieldLabel htmlFor="register-first-name">{t("auth.register.firstName")}</FieldLabel>
              <Input
                id="register-first-name"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                aria-invalid={Boolean(errors.firstName) || undefined}
                onChange={(event) => setFirstName(event.target.value)}
              />
              {errors.firstName ? <FieldError>{errors.firstName}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.lastName) || undefined}>
              <FieldLabel htmlFor="register-last-name">{t("auth.register.lastName")}</FieldLabel>
              <Input
                id="register-last-name"
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                aria-invalid={Boolean(errors.lastName) || undefined}
                onChange={(event) => setLastName(event.target.value)}
              />
              {errors.lastName ? <FieldError>{errors.lastName}</FieldError> : null}
            </Field>
          </div>
          <Field data-invalid={Boolean(errors.username) || undefined}>
            <FieldLabel htmlFor="register-username">{t("auth.register.username")}</FieldLabel>
            <Input
              id="register-username"
              name="username"
              autoComplete="username"
              value={username}
              aria-invalid={Boolean(errors.username) || undefined}
              onChange={(event) => setUsername(event.target.value)}
            />
            {errors.username ? <FieldError>{errors.username}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.email) || undefined}>
            <FieldLabel htmlFor="register-email">{t("auth.register.email")}</FieldLabel>
            <Input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(errors.email) || undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email ? <FieldError>{errors.email}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.password) || undefined}>
            <FieldLabel htmlFor="register-password">{t("auth.register.password")}</FieldLabel>
            <Input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={Boolean(errors.password) || undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors.password ? <FieldError>{errors.password}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.confirmPassword) || undefined}>
            <FieldLabel htmlFor="register-confirm-password">
              {t("auth.register.confirmPassword")}
            </FieldLabel>
            <Input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-invalid={Boolean(errors.confirmPassword) || undefined}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {errors.confirmPassword ? <FieldError>{errors.confirmPassword}</FieldError> : null}
          </Field>
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
            <Button className="w-full" type="submit" disabled={pending || registrationDisabled}>
              {pending ? t("auth.register.submitting") : t("auth.register.submit")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
