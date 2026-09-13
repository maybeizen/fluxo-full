import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  requiredText,
} from "@/features/auth/validation";
import { adminUserQueryKey, adminUsersQueryKey, getAdminUser, patchAdminUser } from "@/features/admin/api";
import { emptyToNull } from "@/features/admin/format";
import { AuthApiError, UserRole } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export type EditUserErrors = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string;
  suspendedReason?: string;
  form?: string;
};

export function useAdminUserEditor(userId: string, currentUserId: string) {
  const queryClient = useQueryClient();
  const userQuery = useQuery({
    queryKey: adminUserQueryKey(userId),
    queryFn: () => getAdminUser(userId),
  });
  const user = userQuery.data;
  const isSelf = user?.id === currentUserId;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.User);
  const [emailVerified, setEmailVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [suspended, setSuspended] = useState(false);
  const [suspendedReason, setSuspendedReason] = useState("");
  const [errors, setErrors] = useState<EditUserErrors>({});

  useEffect(() => {
    if (!user) {
      return;
    }
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setUsername(user.username);
    setEmail(user.email);
    setDateOfBirth(user.dateOfBirth ?? "");
    setCompany(user.company ?? "");
    setRole(user.role);
    setEmailVerified(user.emailVerified);
    setPassword("");
    setSuspended(user.suspended);
    setSuspendedReason(user.suspendedReason ?? "");
    setErrors({});
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!user) {
        throw new Error("User is not loaded");
      }
      return patchAdminUser(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        dateOfBirth: emptyToNull(dateOfBirth),
        company: emptyToNull(company),
        role: isSelf ? user.role : role,
        emailVerified,
        password: password.length > 0 ? password : undefined,
        suspended: isSelf ? user.suspended : suspended,
        suspendedReason: isSelf ? undefined : suspended ? suspendedReason.trim() : null,
      });
    },
    onSuccess: async (next) => {
      queryClient.setQueryData(adminUserQueryKey(next.id), next);
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
      setPassword("");
      toast.success(t("admin.edit.updated"));
    },
    onError: (error) => {
      setErrors({
        form: error instanceof AuthApiError ? error.message : t("admin.edit.unable"),
      });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextErrors: EditUserErrors = {};
    if (!requiredText(firstName)) {
      nextErrors.firstName = t("admin.edit.firstNameRequired");
    }
    if (!requiredText(lastName)) {
      nextErrors.lastName = t("admin.edit.lastNameRequired");
    }
    if (!requiredText(username)) {
      nextErrors.username = t("admin.edit.usernameRequired");
    } else if (!isValidUsername(username)) {
      nextErrors.username = t("admin.edit.usernameInvalid");
    }
    if (!requiredText(email)) {
      nextErrors.email = t("admin.edit.emailRequired");
    } else if (!isValidEmail(email)) {
      nextErrors.email = t("admin.edit.emailInvalid");
    }
    if (password.length > 0 && !isValidPassword(password)) {
      nextErrors.password = t("admin.edit.passwordInvalid");
    }
    if (!isSelf && suspended && !requiredText(suspendedReason)) {
      nextErrors.suspendedReason = t("admin.edit.reasonRequired");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    saveMutation.mutate();
  }

  return {
    user,
    isSelf,
    isPending: userQuery.isPending,
    isError: userQuery.isError || !userQuery.data,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    username,
    setUsername,
    email,
    setEmail,
    dateOfBirth,
    setDateOfBirth,
    company,
    setCompany,
    role,
    setRole,
    emailVerified,
    setEmailVerified,
    password,
    setPassword,
    suspended,
    setSuspended,
    suspendedReason,
    setSuspendedReason,
    errors,
    saving: saveMutation.isPending,
    onSubmit,
  };
}

export type AdminUserEditorModel = ReturnType<typeof useAdminUserEditor>;
