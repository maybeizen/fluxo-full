import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { isValidEmail, requiredText } from "@/features/auth/validation";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { forgotPassword } from "@/lib/auth-api";
import { AuthApiError } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export function useForgotPassword() {
  const settings = usePublicSettings();
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const captchaEnabled =
    settings.securityCaptchaEnabled &&
    settings.securityCaptchaType !== "none" &&
    Boolean(settings.securityCaptchaSiteKey);

  const forgotMutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: () => {
      setSent(true);
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof AuthApiError
          ? mutationError.message
          : t("auth.forgot.unable");
      setError(message);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!requiredText(email)) {
      setError(t("auth.forgot.emailRequired"));
      return;
    }
    if (!isValidEmail(email)) {
      setError(t("auth.forgot.emailInvalid"));
      return;
    }
    if (captchaEnabled && !requiredText(captchaToken)) {
      setError(t("auth.captcha.required"));
      return;
    }

    setError(undefined);
    forgotMutation.mutate({
      email,
      captchaToken: captchaEnabled ? captchaToken : undefined,
    });
  }

  return {
    email,
    setEmail,
    captchaToken,
    setCaptchaToken,
    captchaEnabled,
    captchaType: settings.securityCaptchaType,
    captchaSiteKey: settings.securityCaptchaSiteKey,
    error,
    sent,
    pending: forgotMutation.isPending,
    onSubmit,
  };
}

export type ForgotPasswordFormModel = ReturnType<typeof useForgotPassword>;
