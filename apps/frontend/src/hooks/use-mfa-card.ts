import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { StepUpCancelledError } from "@/features/settings/step-up/errors";
import { useRefreshSession } from "@/features/settings/use-refresh-session";
import { useStepUp } from "@/features/settings/use-step-up";
import { disableMfa, enableMfa, setupMfa } from "@/lib/auth-api";
import { AuthApiError, type MfaSetup, type PublicUser } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export function useMfaCard(user: PublicUser) {
  const refreshSession = useRefreshSession();
  const stepUp = useStepUp(user);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<"setup" | "enable" | "disable" | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  async function onSetup(): Promise<void> {
    setBusy("setup");
    setError(undefined);
    try {
      setSetup(await setupMfa());
    } catch (setupError) {
      setError(
        setupError instanceof AuthApiError ? setupError.message : t("settings.mfa.setupUnable"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function onEnable(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (code.length !== 6) {
      setError(t("settings.mfa.codeRequired"));
      return;
    }
    setBusy("enable");
    setError(undefined);
    try {
      const result = await enableMfa({ code });
      setBackupCodes(result.backupCodes);
      setSetup(null);
      setCode("");
      await refreshSession(result.user);
      toast.success(t("settings.mfa.enabledToast"));
    } catch (enableError) {
      setError(
        enableError instanceof AuthApiError
          ? enableError.message
          : t("settings.mfa.enableUnable"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function onDisable(): Promise<void> {
    setBusy("disable");
    setError(undefined);
    try {
      const challengeId = await stepUp.requestChallenge();
      if (!challengeId) {
        setError(t("settings.mfa.confirmDisable"));
        return;
      }
      const next = await disableMfa({ challengeId });
      setBackupCodes([]);
      await refreshSession(next);
      toast.success(t("settings.mfa.disabledToast"));
    } catch (disableError) {
      if (disableError instanceof StepUpCancelledError) {
        return;
      }
      setError(
        disableError instanceof AuthApiError
          ? disableError.message
          : t("settings.mfa.disableUnable"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function onCopySecret(): Promise<void> {
    if (!setup || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(setup.secret);
    toast.success(t("settings.mfa.secretCopied"));
  }

  return {
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
    onCancelSetup: () => setSetup(null),
    stepUp: {
      open: stepUp.open,
      setOpen: stepUp.setOpen,
      complete: stepUp.complete,
    },
  };
}

export type MfaCardModel = ReturnType<typeof useMfaCard>;
