import { type FormEvent, useState } from "react";
import { stepUpTotp, getStepUpPasskeyOptions, verifyStepUpPasskey } from "@/lib/auth-api";
import { AuthApiError } from "@/lib/auth";
import { startAuthentication } from "@/lib/webauthn";

export function useStepUpDialog({
  error,
  pending,
  onOpenChange,
  onVerified,
}: {
  error?: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (challengeId: string) => void;
}) {
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const displayError = localError ?? error;
  const busy = submitting || pending === true;

  async function handleTotp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (code.length !== 6) {
      setLocalError("Enter the 6-digit authenticator code.");
      return;
    }
    setSubmitting(true);
    setLocalError(undefined);
    try {
      const result = await stepUpTotp({ code });
      setCode("");
      onVerified(result.challengeId);
    } catch (verifyError) {
      setLocalError(
        verifyError instanceof AuthApiError
          ? verifyError.message
          : "Unable to verify the authenticator code.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasskey(): Promise<void> {
    setSubmitting(true);
    setLocalError(undefined);
    try {
      const options = await getStepUpPasskeyOptions();
      const assertion = await startAuthentication({ optionsJSON: options });
      const result = await verifyStepUpPasskey(assertion);
      onVerified(result.challengeId);
    } catch (verifyError) {
      setLocalError(
        verifyError instanceof AuthApiError
          ? verifyError.message
          : "Unable to verify the passkey.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return {
    code,
    displayError,
    busy,
    onCodeChange: setCode,
    onTotpSubmit: handleTotp,
    onPasskey: handlePasskey,
    onOpenChange: (next: boolean) => {
      if (!next) {
        setCode("");
        setLocalError(undefined);
      }
      onOpenChange(next);
    },
  };
}
