import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { passwordsMatch, requiredText } from "@/features/auth/validation";
import { resetPassword } from "@/lib/auth-api";
import { AuthApiError } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export type ResetErrors = {
  password?: string;
  confirmPassword?: string;
  form?: string;
};

export function useResetPassword(token?: string) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ResetErrors>({});

  const resetMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: async () => {
      toast(t("auth.reset.updated"));
      await navigate({ to: "/login" });
    },
    onError: (error) => {
      const message =
        error instanceof AuthApiError ? error.message : t("auth.reset.unable");
      setErrors({ form: message });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextErrors: ResetErrors = {};

    if (!requiredText(password)) {
      nextErrors.password = t("auth.reset.passwordRequired");
    }
    if (!requiredText(confirmPassword)) {
      nextErrors.confirmPassword = t("auth.reset.confirmRequired");
    } else if (!passwordsMatch(password, confirmPassword)) {
      nextErrors.confirmPassword = t("auth.reset.passwordMismatch");
    }
    if (!requiredText(token ?? "")) {
      nextErrors.form = t("auth.reset.tokenInvalid");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !token) {
      return;
    }

    resetMutation.mutate({ token, password });
  }

  return {
    token,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    errors,
    pending: resetMutation.isPending,
    onSubmit,
  };
}

export type ResetPasswordFormModel = ReturnType<typeof useResetPassword>;
