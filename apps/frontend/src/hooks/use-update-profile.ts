import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { isValidEmail, requiredText } from "@/features/auth/validation";
import { emptyToNull } from "@/features/settings/format";
import { StepUpCancelledError } from "@/features/settings/step-up/errors";
import { useRefreshSession } from "@/features/settings/use-refresh-session";
import { useStepUp } from "@/features/settings/use-step-up";
import { changeEmail, updateProfile } from "@/lib/auth-api";
import { AuthApiError, type PublicUser } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export type ProfileErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  form?: string;
};

export function useUpdateProfile(user: PublicUser) {
  const refreshSession = useRefreshSession();
  const stepUp = useStepUp(user);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ?? "");
  const [company, setCompany] = useState(user.company ?? "");
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailPending, setEmailPending] = useState(!user.emailVerified);

  async function onSaveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors: ProfileErrors = {};
    if (!requiredText(firstName)) {
      nextErrors.firstName = t("settings.profile.firstNameRequired");
    }
    if (!requiredText(lastName)) {
      nextErrors.lastName = t("settings.profile.lastNameRequired");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSavingProfile(true);
    try {
      const next = await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: emptyToNull(dateOfBirth),
        company: emptyToNull(company),
      });
      await refreshSession(next);
      toast.success(t("settings.profile.updated"));
    } catch (error) {
      setErrors({
        form: error instanceof AuthApiError ? error.message : t("settings.profile.unable"),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangeEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!requiredText(email)) {
      setErrors({ email: t("settings.email.required") });
      return;
    }
    if (!isValidEmail(email)) {
      setErrors({ email: t("settings.email.invalid") });
      return;
    }
    if (email.trim().toLowerCase() === user.email.toLowerCase()) {
      setErrors({ email: t("settings.email.same") });
      return;
    }

    setSavingEmail(true);
    setErrors({});
    try {
      const challengeId = await stepUp.requestChallenge();
      await changeEmail({ email: email.trim(), challengeId });
      await refreshSession();
      setEmailPending(true);
      toast.success(t("settings.email.sent"));
    } catch (error) {
      if (error instanceof StepUpCancelledError) {
        return;
      }
      setErrors({
        email: error instanceof AuthApiError ? error.message : t("settings.email.unable"),
      });
    } finally {
      setSavingEmail(false);
    }
  }

  return {
    user,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    dateOfBirth,
    setDateOfBirth,
    company,
    setCompany,
    email,
    setEmail,
    errors,
    savingProfile,
    savingEmail,
    emailPending,
    onSaveProfile,
    onChangeEmail,
    stepUp: {
      open: stepUp.open,
      setOpen: stepUp.setOpen,
      complete: stepUp.complete,
    },
  };
}

export type UpdateProfileModel = ReturnType<typeof useUpdateProfile>;
