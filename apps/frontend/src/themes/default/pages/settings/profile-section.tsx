import { MailIcon } from "lucide-react";
import type { AvatarFieldModel } from "@/hooks/use-avatar";
import type { UpdateProfileModel } from "@/hooks/use-update-profile";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { AvatarField } from "./avatar-field";

export function ProfileSection({
  profile,
  avatar,
}: {
  profile: UpdateProfileModel;
  avatar: AvatarFieldModel;
}) {
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Spinner,
  } = useUI();
  const {
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
  } = profile;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile.title")}</CardTitle>
          <CardDescription>{t("settings.profile.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-8 lg:flex-row">
            <AvatarField {...avatar} />
            <form className="min-w-0 flex-1" onSubmit={(event) => void onSaveProfile(event)}>
              <FieldGroup>
                {errors.form ? <FieldError>{errors.form}</FieldError> : null}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field data-invalid={Boolean(errors.firstName) || undefined}>
                    <FieldLabel htmlFor="profile-first-name">{t("settings.profile.firstName")}</FieldLabel>
                    <Input
                      id="profile-first-name"
                      name="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      aria-invalid={Boolean(errors.firstName) || undefined}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                    {errors.firstName ? <FieldError>{errors.firstName}</FieldError> : null}
                  </Field>
                  <Field data-invalid={Boolean(errors.lastName) || undefined}>
                    <FieldLabel htmlFor="profile-last-name">{t("settings.profile.lastName")}</FieldLabel>
                    <Input
                      id="profile-last-name"
                      name="lastName"
                      autoComplete="family-name"
                      value={lastName}
                      aria-invalid={Boolean(errors.lastName) || undefined}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                    {errors.lastName ? <FieldError>{errors.lastName}</FieldError> : null}
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="profile-dob">{t("settings.profile.dob")}</FieldLabel>
                  <Input
                    id="profile-dob"
                    name="dateOfBirth"
                    type="date"
                    autoComplete="bday"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                  />
                  <FieldDescription>{t("settings.profile.dobHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-company">{t("settings.profile.company")}</FieldLabel>
                  <Input
                    id="profile-company"
                    name="company"
                    autoComplete="organization"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                  />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? <Spinner data-icon="inline-start" /> : null}
                    {savingProfile ? t("settings.profile.saving") : t("settings.profile.save")}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.email.title")}</CardTitle>
          <CardDescription>{t("settings.email.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void onChangeEmail(event)}>
            <FieldGroup>
              {emailPending ? (
                <Alert>
                  <MailIcon />
                  <AlertTitle>{t("settings.email.reverifyTitle")}</AlertTitle>
                  <AlertDescription>{t("settings.email.reverifyBody")}</AlertDescription>
                </Alert>
              ) : null}
              <Field data-invalid={Boolean(errors.email) || undefined}>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="profile-email">{t("settings.email.label")}</FieldLabel>
                  <Badge variant={user.emailVerified && !emailPending ? "secondary" : "outline"}>
                    {user.emailVerified && !emailPending
                      ? t("settings.email.verified")
                      : t("settings.email.unverified")}
                  </Badge>
                </div>
                <Input
                  id="profile-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  aria-invalid={Boolean(errors.email) || undefined}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <FieldDescription>{t("settings.email.help")}</FieldDescription>
                {errors.email ? <FieldError>{errors.email}</FieldError> : null}
              </Field>
            </FieldGroup>
            <CardFooter className="mt-6 justify-end px-0">
              <Button type="submit" disabled={savingEmail}>
                {savingEmail ? <Spinner data-icon="inline-start" /> : null}
                {savingEmail ? t("settings.email.updating") : t("settings.email.change")}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
