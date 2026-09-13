import type { PasswordCardModel } from "@/hooks/use-password-card";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function PasswordCard({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  errors,
  saving,
  emailing,
  usingToken,
  onSubmit,
  onEmailLink,
}: PasswordCardModel) {
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Spinner,
  } = useUI();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.password.title")}</CardTitle>
        <CardDescription>{t("settings.password.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)}>
          <FieldGroup>
            {errors.form ? <FieldError>{errors.form}</FieldError> : null}
            {usingToken ? (
              <Alert>
                <AlertTitle>{t("settings.password.tokenTitle")}</AlertTitle>
                <AlertDescription>{t("settings.password.tokenBody")}</AlertDescription>
              </Alert>
            ) : (
              <Field data-invalid={Boolean(errors.currentPassword) || undefined}>
                <FieldLabel htmlFor="security-current-password">
                  {t("settings.password.current")}
                </FieldLabel>
                <Input
                  id="security-current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  aria-invalid={Boolean(errors.currentPassword) || undefined}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
                <FieldDescription>{t("settings.password.currentHelp")}</FieldDescription>
                {errors.currentPassword ? <FieldError>{errors.currentPassword}</FieldError> : null}
              </Field>
            )}
            <Field data-invalid={Boolean(errors.newPassword) || undefined}>
              <FieldLabel htmlFor="security-new-password">{t("settings.password.new")}</FieldLabel>
              <Input
                id="security-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                aria-invalid={Boolean(errors.newPassword) || undefined}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              {errors.newPassword ? <FieldError>{errors.newPassword}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.confirmPassword) || undefined}>
              <FieldLabel htmlFor="security-confirm-password">
                {t("settings.password.confirm")}
              </FieldLabel>
              <Input
                id="security-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                aria-invalid={Boolean(errors.confirmPassword) || undefined}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {errors.confirmPassword ? <FieldError>{errors.confirmPassword}</FieldError> : null}
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {usingToken ? null : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || emailing}
                  onClick={() => void onEmailLink()}
                >
                  {emailing ? <Spinner data-icon="inline-start" /> : null}
                  {emailing ? t("settings.password.sending") : t("settings.password.emailLink")}
                </Button>
              )}
              <Button type="submit" disabled={saving || emailing}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {saving ? t("settings.password.updating") : t("settings.password.update")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
