import { REGEXP_ONLY_DIGITS } from "input-otp";
import { CopyIcon, ShieldCheckIcon } from "lucide-react";
import type { MfaCardModel } from "@/hooks/use-mfa-card";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function MfaCard({
  user,
  setup,
  code,
  setCode,
  error,
  busy,
  backupCodes,
  onSetup,
  onEnable,
  onDisable,
  onCopySecret,
  onCancelSetup,
}: MfaCardModel) {
  const {
    BackupCodesPanel,
    Badge,
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
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    Spinner,
  } = useUI();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{t("settings.mfa.title")}</CardTitle>
              <CardDescription>{t("settings.mfa.description")}</CardDescription>
            </div>
            <Badge variant={user.mfaEnabled ? "secondary" : "outline"}>
              {user.mfaEnabled ? t("settings.mfa.enabled") : t("settings.mfa.off")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <FieldError>{error}</FieldError> : null}
          {user.mfaEnabled ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => void onDisable()}
            >
              {busy === "disable" ? <Spinner data-icon="inline-start" /> : null}
              {busy === "disable" ? t("settings.mfa.disabling") : t("settings.mfa.disable")}
            </Button>
          ) : setup ? (
            <form onSubmit={(event) => void onEnable(event)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="mfa-secret">{t("settings.mfa.secret")}</FieldLabel>
                  <div className="flex gap-2">
                    <Input id="mfa-secret" readOnly value={setup.secret} />
                    <Button type="button" variant="outline" size="icon" onClick={() => void onCopySecret()}>
                      <CopyIcon />
                      <span className="sr-only">Copy secret</span>
                    </Button>
                  </div>
                  <FieldDescription>{setup.otpauthUrl}</FieldDescription>
                </Field>
                <Field data-invalid={Boolean(error) || undefined}>
                  <FieldLabel htmlFor="mfa-enable-code">{t("settings.mfa.code")}</FieldLabel>
                  <div className="flex justify-center">
                    <InputOTP
                      id="mfa-enable-code"
                      maxLength={6}
                      value={code}
                      pattern={REGEXP_ONLY_DIGITS}
                      aria-label="Authentication code"
                      onChange={setCode}
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
                  <FieldDescription>{t("settings.mfa.codeHelp")}</FieldDescription>
                </Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={onCancelSetup}>
                    {t("settings.mfa.cancel")}
                  </Button>
                  <Button type="submit" disabled={busy !== null}>
                    {busy === "enable" ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <ShieldCheckIcon data-icon="inline-start" />
                    )}
                    {busy === "enable" ? t("settings.mfa.enabling") : t("settings.mfa.enable")}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          ) : (
            <Button type="button" disabled={busy !== null} onClick={() => void onSetup()}>
              {busy === "setup" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ShieldCheckIcon data-icon="inline-start" />
              )}
              {busy === "setup" ? t("settings.mfa.preparing") : t("settings.mfa.setup")}
            </Button>
          )}
        </CardContent>
      </Card>
      {backupCodes.length > 0 ? <BackupCodesPanel codes={backupCodes} /> : null}
    </div>
  );
}
