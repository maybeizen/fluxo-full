import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { requiredText } from "@/features/auth/validation";
import { verifyMfa } from "@/lib/auth-api";
import { AuthApiError, authMeQueryKey } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export type MfaMode = "totp" | "backup";

export function useMfa() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<MfaMode>("totp");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mfaMutation = useMutation({
    mutationFn: verifyMfa,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      await navigate({ to: "/dashboard" });
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof AuthApiError
          ? mutationError.message
          : t("auth.mfa.unable");
      setError(message);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (mode === "totp") {
      if (code.length !== 6) {
        setError(t("auth.mfa.codeRequired"));
        return;
      }
      setError(undefined);
      mfaMutation.mutate({ code });
      return;
    }

    if (!requiredText(backupCode)) {
      setError(t("auth.mfa.backupRequired"));
      return;
    }

    setError(undefined);
    mfaMutation.mutate({ code: backupCode.trim() });
  }

  function toggleMode(): void {
    setError(undefined);
    setMode((current) => (current === "totp" ? "backup" : "totp"));
  }

  return {
    mode,
    code,
    setCode,
    backupCode,
    setBackupCode,
    error,
    pending: mfaMutation.isPending,
    onSubmit,
    toggleMode,
  };
}

export type MfaFormModel = ReturnType<typeof useMfa>;
