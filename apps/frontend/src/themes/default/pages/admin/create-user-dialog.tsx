import type { CreateUserModel } from "@/hooks/use-create-user";
import { UserRole } from "@/lib/auth";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function CreateUserDialog({
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
  pending,
  onSubmit,
}: CreateUserModel) {
  const {
    Button,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    NativeSelect,
    Spinner,
  } = useUI();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>{t("admin.create.trigger")}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{t("admin.create.title")}</DialogTitle>
            <DialogDescription>{t("admin.create.description")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {errors.form ? <FieldError>{errors.form}</FieldError> : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.firstName) || undefined}>
                <FieldLabel htmlFor="create-first-name">{t("admin.create.firstName")}</FieldLabel>
                <Input
                  id="create-first-name"
                  value={firstName}
                  aria-invalid={Boolean(errors.firstName) || undefined}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                {errors.firstName ? <FieldError>{errors.firstName}</FieldError> : null}
              </Field>
              <Field data-invalid={Boolean(errors.lastName) || undefined}>
                <FieldLabel htmlFor="create-last-name">{t("admin.create.lastName")}</FieldLabel>
                <Input
                  id="create-last-name"
                  value={lastName}
                  aria-invalid={Boolean(errors.lastName) || undefined}
                  onChange={(event) => setLastName(event.target.value)}
                />
                {errors.lastName ? <FieldError>{errors.lastName}</FieldError> : null}
              </Field>
            </div>
            <Field data-invalid={Boolean(errors.username) || undefined}>
              <FieldLabel htmlFor="create-username">{t("admin.create.username")}</FieldLabel>
              <Input
                id="create-username"
                autoComplete="off"
                value={username}
                aria-invalid={Boolean(errors.username) || undefined}
                onChange={(event) => setUsername(event.target.value)}
              />
              {errors.username ? <FieldError>{errors.username}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.email) || undefined}>
              <FieldLabel htmlFor="create-email">{t("admin.create.email")}</FieldLabel>
              <Input
                id="create-email"
                type="email"
                autoComplete="off"
                value={email}
                aria-invalid={Boolean(errors.email) || undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
              {errors.email ? <FieldError>{errors.email}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.password) || undefined}>
              <FieldLabel htmlFor="create-password">{t("admin.create.password")}</FieldLabel>
              <Input
                id="create-password"
                type="password"
                autoComplete="new-password"
                value={password}
                aria-invalid={Boolean(errors.password) || undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              {errors.password ? <FieldError>{errors.password}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="create-role">{t("admin.create.role")}</FieldLabel>
              <NativeSelect
                id="create-role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value={UserRole.User}>{t("admin.create.roleUser")}</option>
                <option value={UserRole.Admin}>{t("admin.create.roleAdmin")}</option>
              </NativeSelect>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="create-verified"
                checked={emailVerified}
                onCheckedChange={(checked) => setEmailVerified(checked === true)}
              />
              <FieldLabel htmlFor="create-verified">{t("admin.create.verified")}</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? t("admin.create.creating") : t("admin.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
