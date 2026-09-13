import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ShieldCheckIcon } from "lucide-react";
import type { MfaFormModel } from "@/hooks/use-mfa";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function MfaForm({
  mode,
  code,
  setCode,
  backupCode,
  setBackupCode,
  error,
  pending,
  onSubmit,
  toggleMode,
}: MfaFormModel) {
  const {
    AuthCard,
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
  } = useUI();

  return (
    <AuthCard title={t("auth.mfa.title")} description={t("auth.mfa.description")}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <ShieldCheckIcon className="size-4 text-primary" />
            <p className="text-sm text-muted-foreground">{t("auth.mfa.hint")}</p>
          </div>
          {mode === "totp" ? (
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="mfa-code">{t("auth.mfa.code")}</FieldLabel>
              <div className="flex justify-center">
                <InputOTP
                  id="mfa-code"
                  maxLength={6}
                  value={code}
                  pattern={REGEXP_ONLY_DIGITS}
                  aria-label="Authentication code"
                  aria-invalid={Boolean(error) || undefined}
                  onChange={(value) => setCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <FieldDescription>{t("auth.mfa.codeHelp")}</FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          ) : (
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="mfa-backup">{t("auth.mfa.backup")}</FieldLabel>
              <Input
                id="mfa-backup"
                name="backupCode"
                autoComplete="one-time-code"
                value={backupCode}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => setBackupCode(event.target.value)}
              />
              <FieldDescription>{t("auth.mfa.backupHelp")}</FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          )}
          <Field>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? t("auth.mfa.verifying") : t("auth.mfa.verify")}
            </Button>
          </Field>
          <Field>
            <Button className="w-full" type="button" variant="link" onClick={toggleMode}>
              {mode === "totp" ? t("auth.mfa.useBackup") : t("auth.mfa.useAuthenticator")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
