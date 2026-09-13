import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StepUpCancelledError } from "@/features/settings/step-up/errors";
import { useRefreshSession } from "@/features/settings/use-refresh-session";
import { useStepUp } from "@/features/settings/use-step-up";
import {
  deletePasskey,
  getPasskeyRegisterOptions,
  listPasskeys,
  verifyPasskeyRegistration,
} from "@/lib/auth-api";
import { AuthApiError, authPasskeysQueryKey, type PublicUser } from "@/lib/auth";
import { startRegistration } from "@/lib/webauthn";
import { t } from "@/theme-system/use-t";

export function usePasskeys(user: PublicUser) {
  const queryClient = useQueryClient();
  const refreshSession = useRefreshSession();
  const stepUp = useStepUp(user);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();

  const passkeysQuery = useQuery({
    queryKey: authPasskeysQueryKey,
    queryFn: listPasskeys,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const options = await getPasskeyRegisterOptions();
      const attestation = await startRegistration({ optionsJSON: options });
      const trimmed = name.trim();
      await verifyPasskeyRegistration(
        trimmed.length > 0 ? { ...attestation, name: trimmed } : attestation,
      );
    },
    onSuccess: async () => {
      setName("");
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: authPasskeysQueryKey });
      await refreshSession();
      toast.success(t("settings.passkeys.added"));
    },
    onError: (registerError) => {
      setError(
        registerError instanceof AuthApiError
          ? registerError.message
          : t("settings.passkeys.addUnable"),
      );
    },
  });

  async function onDelete(id: string): Promise<void> {
    setError(undefined);
    try {
      const challengeId = await stepUp.requestChallenge();
      await deletePasskey(id, challengeId);
      await queryClient.invalidateQueries({ queryKey: authPasskeysQueryKey });
      await refreshSession();
      toast.success(t("settings.passkeys.removed"));
    } catch (deleteError) {
      if (deleteError instanceof StepUpCancelledError) {
        return;
      }
      setError(
        deleteError instanceof AuthApiError
          ? deleteError.message
          : t("settings.passkeys.removeUnable"),
      );
    }
  }

  return {
    user,
    name,
    setName,
    error,
    passkeys: passkeysQuery.data ?? [],
    isPending: passkeysQuery.isPending,
    registering: registerMutation.isPending,
    onRegister: () => registerMutation.mutate(),
    onDelete,
    stepUp: {
      open: stepUp.open,
      setOpen: stepUp.setOpen,
      complete: stepUp.complete,
    },
  };
}

export type PasskeysCardModel = ReturnType<typeof usePasskeys>;
