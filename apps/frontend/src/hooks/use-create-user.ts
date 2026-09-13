import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  requiredText,
} from "@/features/auth/validation";
import { adminUsersQueryKey, createAdminUser } from "@/features/admin/api";
import { AuthApiError, UserRole } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export type CreateUserErrors = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string;
  form?: string;
};

export function useCreateUser() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.User);
  const [emailVerified, setEmailVerified] = useState(true);
  const [errors, setErrors] = useState<CreateUserErrors>({});

  function resetForm(): void {
    setFirstName("");
    setLastName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRole(UserRole.User);
    setEmailVerified(true);
    setErrors({});
  }

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
      toast.success(t("admin.create.created"));
      resetForm();
      setOpen(false);
    },
    onError: (error) => {
      setErrors({
        form: error instanceof AuthApiError ? error.message : t("admin.create.unable"),
      });
    },
  });

  function onOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextErrors: CreateUserErrors = {};
    if (!requiredText(firstName)) {
      nextErrors.firstName = t("admin.create.firstNameRequired");
    }
    if (!requiredText(lastName)) {
      nextErrors.lastName = t("admin.create.lastNameRequired");
    }
    if (!requiredText(username)) {
      nextErrors.username = t("admin.create.usernameRequired");
    } else if (!isValidUsername(username)) {
      nextErrors.username = t("admin.create.usernameInvalid");
    }
    if (!requiredText(email)) {
      nextErrors.email = t("admin.create.emailRequired");
    } else if (!isValidEmail(email)) {
      nextErrors.email = t("admin.create.emailInvalid");
    }
    if (!requiredText(password)) {
      nextErrors.password = t("admin.create.passwordRequired");
    } else if (!isValidPassword(password)) {
      nextErrors.password = t("admin.create.passwordInvalid");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    createMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      email: email.trim(),
      password,
      role,
      emailVerified,
    });
  }

  return {
    open,
    onOpenChange,
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
    role,
    setRole,
    emailVerified,
    setEmailVerified,
    errors,
    pending: createMutation.isPending,
    onSubmit,
  };
}

export type CreateUserModel = ReturnType<typeof useCreateUser>;
