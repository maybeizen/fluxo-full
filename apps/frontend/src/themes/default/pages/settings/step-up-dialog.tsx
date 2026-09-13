import { REGEXP_ONLY_DIGITS } from "input-otp";
import { FingerprintIcon, ShieldCheckIcon } from "lucide-react";
import type { FormEvent } from "react";
import type { PublicUser } from "@/lib/auth";
import { useUI } from "@/theme-system/use-ui";

export function StepUpDialog({
  user,
  open,
  displayError,
  busy,
  code,
  onCodeChange,
  onOpenChange,
  onTotpSubmit,
  onPasskey,
}: {
  user: PublicUser;
  open: boolean;
  displayError?: string;
  busy: boolean;
  code: string;
  onCodeChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onTotpSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPasskey: () => void;
}) {
  const {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    Spinner,
  } = useUI();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm it is you</DialogTitle>
          <DialogDescription>
            This action needs an extra check because two-factor authentication or a passkey is
            enabled.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
          <ShieldCheckIcon className="mt-0.5 size-4 text-primary" />
          <p className="text-sm text-muted-foreground">
            Use your authenticator app or a registered passkey to continue.
          </p>
        </div>
        {user.mfaEnabled ? (
          <form onSubmit={(event) => void onTotpSubmit(event)}>
            <FieldGroup>
              <Field data-invalid={Boolean(displayError) || undefined}>
                <FieldLabel htmlFor="step-up-code">Authentication code</FieldLabel>
                <div className="flex justify-center">
                  <InputOTP
                    id="step-up-code"
                    maxLength={6}
                    value={code}
                    pattern={REGEXP_ONLY_DIGITS}
                    aria-label="Authentication code"
                    aria-invalid={Boolean(displayError) || undefined}
                    onChange={onCodeChange}
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
                <FieldDescription>Enter the 6-digit code from your authenticator.</FieldDescription>
                {displayError ? <FieldError>{displayError}</FieldError> : null}
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy ? <Spinner data-icon="inline-start" /> : null}
                  {busy ? "Verifying..." : "Verify code"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        ) : displayError ? (
          <FieldError>{displayError}</FieldError>
        ) : null}
        {user.hasPasskey ? (
          <Button
            className="w-full"
            type="button"
            variant={user.mfaEnabled ? "outline" : "default"}
            disabled={busy}
            onClick={() => void onPasskey()}
          >
            {busy ? <Spinner data-icon="inline-start" /> : <FingerprintIcon data-icon="inline-start" />}
            Continue with passkey
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
