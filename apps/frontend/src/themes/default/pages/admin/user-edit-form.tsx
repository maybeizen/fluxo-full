import type { ReactNode } from "react";
import { formatExactDateTime } from "@/features/admin/format";
import type { AdminUserDetail } from "@/features/admin/types";
import type { AdminUserEditorModel } from "@/hooks/use-admin-user-editor";
import { UserRole } from "@/lib/auth";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { SignInMethods } from "./sign-in-methods";

export function UserEditForm({
  user,
  isSelf,
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
  saving,
  onSubmit,
  extraSections,
}: AdminUserEditorModel & { user: AdminUserDetail; extraSections?: ReactNode }) {
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Checkbox,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    NativeSelect,
    Spinner,
    Textarea,
    UserOverviewCard,
  } = useUI();

  return (
    <>
    <form className="flex flex-col gap-6" onSubmit={(event) => void onSubmit(event)}>
      {errors.form ? (
        <Alert variant="destructive">
          <AlertTitle>{t("admin.edit.saveFailed")}</AlertTitle>
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}

      <UserOverviewCard user={user} />

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.edit.account")}</CardTitle>
          <CardDescription>{t("admin.edit.accountDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="user-joined">{t("admin.edit.joined")}</FieldLabel>
                <Input id="user-joined" value={formatExactDateTime(user.createdAt)} readOnly />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-last-active">{t("admin.edit.lastActive")}</FieldLabel>
                <Input id="user-last-active" value={formatExactDateTime(user.lastActiveAt)} readOnly />
              </Field>
            </div>
            {user.suspended ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">{t("admin.edit.suspended")}</Badge>
              </div>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      <SignInMethods user={user} />

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.edit.profile")}</CardTitle>
          <CardDescription>{t("admin.edit.profileDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.firstName) || undefined}>
                <FieldLabel htmlFor="edit-first-name">{t("admin.edit.firstName")}</FieldLabel>
                <Input
                  id="edit-first-name"
                  value={firstName}
                  aria-invalid={Boolean(errors.firstName) || undefined}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                {errors.firstName ? <FieldError>{errors.firstName}</FieldError> : null}
              </Field>
              <Field data-invalid={Boolean(errors.lastName) || undefined}>
                <FieldLabel htmlFor="edit-last-name">{t("admin.edit.lastName")}</FieldLabel>
                <Input
                  id="edit-last-name"
                  value={lastName}
                  aria-invalid={Boolean(errors.lastName) || undefined}
                  onChange={(event) => setLastName(event.target.value)}
                />
                {errors.lastName ? <FieldError>{errors.lastName}</FieldError> : null}
              </Field>
            </div>
            <Field data-invalid={Boolean(errors.username) || undefined}>
              <FieldLabel htmlFor="edit-username">{t("admin.edit.username")}</FieldLabel>
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Input
                  id="edit-username"
                  value={username}
                  aria-invalid={Boolean(errors.username) || undefined}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              {errors.username ? <FieldError>{errors.username}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.email) || undefined}>
              <FieldLabel htmlFor="edit-email">{t("admin.edit.email")}</FieldLabel>
              <Input
                id="edit-email"
                type="email"
                value={email}
                aria-invalid={Boolean(errors.email) || undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
              {errors.email ? <FieldError>{errors.email}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-dob">{t("admin.edit.dob")}</FieldLabel>
              <Input
                id="edit-dob"
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-company">{t("admin.edit.company")}</FieldLabel>
              <Input
                id="edit-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.edit.access")}</CardTitle>
          <CardDescription>{t("admin.edit.accessDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-disabled={isSelf || undefined}>
              <FieldLabel htmlFor="edit-role">{t("admin.edit.role")}</FieldLabel>
              <NativeSelect
                id="edit-role"
                value={role}
                disabled={isSelf}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value={UserRole.User}>{t("admin.edit.roleUser")}</option>
                <option value={UserRole.Admin}>{t("admin.edit.roleAdmin")}</option>
              </NativeSelect>
              {isSelf ? <FieldDescription>{t("admin.edit.roleSelf")}</FieldDescription> : null}
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="edit-verified"
                checked={emailVerified}
                onCheckedChange={(checked) => setEmailVerified(checked === true)}
              />
              <FieldLabel htmlFor="edit-verified">{t("admin.edit.verified")}</FieldLabel>
            </Field>
            <Field data-invalid={Boolean(errors.password) || undefined}>
              <FieldLabel htmlFor="edit-password">{t("admin.edit.password")}</FieldLabel>
              <Input
                id="edit-password"
                type="password"
                autoComplete="new-password"
                value={password}
                aria-invalid={Boolean(errors.password) || undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              <FieldDescription>{t("admin.edit.passwordHelp")}</FieldDescription>
              {errors.password ? <FieldError>{errors.password}</FieldError> : null}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.edit.suspend")}</CardTitle>
          <CardDescription>{t("admin.edit.suspendDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal" data-disabled={isSelf || undefined}>
              <Checkbox
                id="edit-suspended"
                checked={suspended}
                disabled={isSelf}
                onCheckedChange={(checked) => setSuspended(checked === true)}
              />
              <FieldLabel htmlFor="edit-suspended">{t("admin.edit.suspended")}</FieldLabel>
            </Field>
            {isSelf ? <FieldDescription>{t("admin.edit.suspendSelf")}</FieldDescription> : null}
            {user.suspendedAt ? (
              <FieldDescription>
                {t("admin.edit.heldSince", { date: formatExactDateTime(user.suspendedAt) })}
              </FieldDescription>
            ) : null}
            {suspended ? (
              <Field data-invalid={Boolean(errors.suspendedReason) || undefined}>
                <FieldLabel htmlFor="edit-suspended-reason">{t("admin.edit.reason")}</FieldLabel>
                <Textarea
                  id="edit-suspended-reason"
                  value={suspendedReason}
                  aria-invalid={Boolean(errors.suspendedReason) || undefined}
                  onChange={(event) => setSuspendedReason(event.target.value)}
                />
                <FieldDescription>{t("admin.edit.reasonHelp")}</FieldDescription>
                {errors.suspendedReason ? <FieldError>{errors.suspendedReason}</FieldError> : null}
              </Field>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {saving ? t("admin.edit.saving") : t("admin.edit.save")}
          </Button>
        </CardFooter>
      </Card>
    </form>
    {extraSections}
    </>
  );
}
