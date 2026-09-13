import { Link } from "@tanstack/react-router";
import type { ResetPasswordFormModel } from "@/hooks/use-reset-password";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function ResetPasswordForm({
  token,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  errors,
  pending,
  onSubmit,
}: ResetPasswordFormModel) {
  const { AuthCard, Button, Field, FieldDescription, FieldError, FieldGroup, FieldLabel, Input } =
    useUI();

  return (
    <AuthCard
      title={t("auth.reset.title")}
      description={t("auth.reset.description")}
      footer={
        <Button variant="link" nativeButton={false} render={<Link to="/login" />}>
          {t("auth.reset.back")}
        </Button>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup>
          {errors.form ? <FieldError>{errors.form}</FieldError> : null}
          <Field data-invalid={Boolean(errors.password) || undefined}>
            <FieldLabel htmlFor="reset-password">{t("auth.reset.password")}</FieldLabel>
            <Input
              id="reset-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={Boolean(errors.password) || undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FieldDescription>
              {token ? t("auth.reset.tokenHelp") : t("auth.reset.tokenMissingHelp")}
            </FieldDescription>
            {errors.password ? <FieldError>{errors.password}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.confirmPassword) || undefined}>
            <FieldLabel htmlFor="reset-confirm-password">{t("auth.reset.confirmPassword")}</FieldLabel>
            <Input
              id="reset-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-invalid={Boolean(errors.confirmPassword) || undefined}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {errors.confirmPassword ? <FieldError>{errors.confirmPassword}</FieldError> : null}
          </Field>
          <Field>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? t("auth.reset.updating") : t("auth.reset.submit")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
