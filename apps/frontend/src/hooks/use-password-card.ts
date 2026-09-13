import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { passwordsMatch, requiredText } from "@/features/auth/validation";
import { StepUpCancelledError } from "@/features/settings/step-up/errors";
import { useStepUp } from "@/features/settings/use-step-up";
import { changePassword, requestPasswordEmailChallenge } from "@/lib/auth-api";
import { AuthApiError, type PublicUser } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export type PasswordErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  form?: string;
};

export function usePasswordCard(user: PublicUser, token?: string) {
  const stepUp = useStepUp(user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const usingToken = Boolean(token);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors: PasswordErrors = {};
    if (!usingToken && !requiredText(currentPassword)) {
      nextErrors.currentPassword = t("settings.password.currentRequired");
    }
    if (!requiredText(newPassword)) {
      nextErrors.newPassword = t("settings.password.newRequired");
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = t("settings.password.tooShort");
    }
    if (!requiredText(confirmPassword)) {
      nextErrors.confirmPassword = t("settings.password.confirmRequired");
    } else if (!passwordsMatch(newPassword, confirmPassword)) {
      nextErrors.confirmPassword = t("settings.password.mismatch");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const challengeId = await stepUp.requestChallenge();
      await changePassword({
        currentPassword: usingToken ? undefined : currentPassword,
        token: usingToken ? token : undefined,
        newPassword,
        challengeId,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("settings.password.updated"));
    } catch (error) {
      if (error instanceof StepUpCancelledError) {
        return;
      }
      setErrors({
        form: error instanceof AuthApiError ? error.message : t("settings.password.unable"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function onEmailLink(): Promise<void> {
    setEmailing(true);
    setErrors({});
    try {
      await requestPasswordEmailChallenge();
      toast.success(t("settings.password.emailSent"));
    } catch (error) {
      setErrors({
        form:
          error instanceof AuthApiError
            ? error.message
            : t("settings.password.emailUnable"),
      });
    } finally {
      setEmailing(false);
    }
  }

  return {
    user,
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
    stepUp: {
      open: stepUp.open,
      setOpen: stepUp.setOpen,
      complete: stepUp.complete,
    },
  };
}

export type PasswordCardModel = ReturnType<typeof usePasswordCard>;
