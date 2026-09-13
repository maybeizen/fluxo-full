import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { requiredText } from "@/features/auth/validation";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { getPasskeyLoginOptions, login, verifyPasskeyLogin } from "@/lib/auth-api";
import { AuthApiError, authMeQueryKey } from "@/lib/auth";
import { startAuthentication } from "@/lib/webauthn";
import { t } from "@/theme-system/use-t";

export type LoginErrors = {
  username?: string;
  password?: string;
  captcha?: string;
  form?: string;
};

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = usePublicSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const captchaEnabled =
    settings.securityCaptchaEnabled &&
    settings.securityCaptchaType !== "none" &&
    Boolean(settings.securityCaptchaSiteKey);

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      if (result.requiresMfa === true) {
        await navigate({ to: "/mfa" });
        return;
      }
      await navigate({ to: "/dashboard" });
    },
    onError: (error) => {
      const message = error instanceof AuthApiError ? error.message : t("auth.login.unable");
      setErrors({ form: message });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextErrors: LoginErrors = {};

    if (!requiredText(username)) {
      nextErrors.username = t("auth.login.usernameRequired");
    }
    if (!requiredText(password)) {
      nextErrors.password = t("auth.login.passwordRequired");
    }
    if (captchaEnabled && !requiredText(captchaToken)) {
      nextErrors.captcha = t("auth.captcha.required");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    loginMutation.mutate({
      username,
      password,
      rememberMe: remember,
      captchaToken: captchaEnabled ? captchaToken : undefined,
    });
  }

  const passkeyMutation = useMutation({
    mutationFn: async () => {
      const options = await getPasskeyLoginOptions(username.trim() || undefined);
      const assertion = await startAuthentication({ optionsJSON: options });
      return verifyPasskeyLogin(assertion);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      if (result.requiresMfa === true) {
        await navigate({ to: "/mfa" });
        return;
      }
      await navigate({ to: "/dashboard" });
    },
    onError: (error) => {
      const message =
        error instanceof AuthApiError ? error.message : t("auth.login.passkeyUnable");
      setErrors({ form: message });
    },
  });

  return {
    username,
    setUsername,
    password,
    setPassword,
    remember,
    setRemember,
    captchaToken,
    setCaptchaToken,
    captchaEnabled,
    captchaType: settings.securityCaptchaType,
    captchaSiteKey: settings.securityCaptchaSiteKey,
    loginDisabled: settings.authDisableLogin,
    errors,
    pending: loginMutation.isPending,
    passkeyPending: passkeyMutation.isPending,
    onSubmit,
    onPasskey: () => {
      setErrors({});
      passkeyMutation.mutate();
    },
  };
}

export type LoginFormModel = ReturnType<typeof useLogin>;
