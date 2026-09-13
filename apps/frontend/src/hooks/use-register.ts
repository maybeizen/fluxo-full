import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { isValidEmail, passwordsMatch, requiredText } from "@/features/auth/validation";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { register } from "@/lib/auth-api";
import { AuthApiError } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export type RegisterErrors = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  captcha?: string;
  form?: string;
};

export function useRegister() {
  const navigate = useNavigate();
  const settings = usePublicSettings();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>({});
  const captchaEnabled =
    settings.securityCaptchaEnabled &&
    settings.securityCaptchaType !== "none" &&
    Boolean(settings.securityCaptchaSiteKey);

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: async (result) => {
      if (result.user.emailVerified) {
        await navigate({ to: "/confirm-email", search: { status: "success" } });
        return;
      }
      await navigate({ to: "/confirm-email" });
    },
    onError: (error) => {
      const message =
        error instanceof AuthApiError ? error.message : t("auth.register.unable");
      setErrors({ form: message });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextErrors: RegisterErrors = {};

    if (!requiredText(firstName)) {
      nextErrors.firstName = t("auth.register.firstNameRequired");
    }
    if (!requiredText(lastName)) {
      nextErrors.lastName = t("auth.register.lastNameRequired");
    }
    if (!requiredText(username)) {
      nextErrors.username = t("auth.register.usernameRequired");
    }
    if (!requiredText(email)) {
      nextErrors.email = t("auth.register.emailRequired");
    } else if (!isValidEmail(email)) {
      nextErrors.email = t("auth.register.emailInvalid");
    }
    if (!requiredText(password)) {
      nextErrors.password = t("auth.register.passwordRequired");
    }
    if (!requiredText(confirmPassword)) {
      nextErrors.confirmPassword = t("auth.register.confirmRequired");
    } else if (!passwordsMatch(password, confirmPassword)) {
      nextErrors.confirmPassword = t("auth.register.passwordMismatch");
    }
    if (captchaEnabled && !requiredText(captchaToken)) {
      nextErrors.captcha = t("auth.captcha.required");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    registerMutation.mutate({
      firstName,
      lastName,
      username,
      email,
      password,
      captchaToken: captchaEnabled ? captchaToken : undefined,
    });
  }

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    username,
    setUsername,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    captchaToken,
    setCaptchaToken,
    captchaEnabled,
    captchaType: settings.securityCaptchaType,
    captchaSiteKey: settings.securityCaptchaSiteKey,
    registrationDisabled: settings.authDisableRegistration,
    errors,
    pending: registerMutation.isPending,
    onSubmit,
  };
}

export type RegisterFormModel = ReturnType<typeof useRegister>;
