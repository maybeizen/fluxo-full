import { FingerprintIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { formatDateTime } from "@/features/settings/format";
import type { PasskeysCardModel } from "@/hooks/use-passkeys";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function PasskeysCard({
  name,
  setName,
  error,
  passkeys,
  isPending,
  registering,
  onRegister,
  onDelete,
}: PasskeysCardModel) {
  const {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } = useUI();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.passkeys.title")}</CardTitle>
        <CardDescription>{t("settings.passkeys.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          {error ? <FieldError>{error}</FieldError> : null}
          <Field>
            <FieldLabel htmlFor="passkey-name">{t("settings.passkeys.name")}</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="passkey-name"
                name="passkeyName"
                placeholder="Laptop"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="button" disabled={registering} onClick={onRegister}>
                {registering ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
                {t("settings.passkeys.add")}
              </Button>
            </div>
          </Field>
        </FieldGroup>
        {isPending ? (
          <p className="text-sm text-muted-foreground">{t("settings.passkeys.loading")}</p>
        ) : passkeys.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            <FingerprintIcon className="size-4 text-primary" />
            {t("settings.passkeys.empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.passkeys.column.name")}</TableHead>
                <TableHead>{t("settings.passkeys.column.added")}</TableHead>
                <TableHead>{t("settings.passkeys.column.lastUsed")}</TableHead>
                <TableHead className="text-right">{t("settings.passkeys.column.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passkeys.map((passkey) => (
                <TableRow key={passkey.id}>
                  <TableCell>{passkey.name?.trim() || t("settings.passkeys.unnamed")}</TableCell>
                  <TableCell>{formatDateTime(passkey.createdAt)}</TableCell>
                  <TableCell>
                    {passkey.lastUsedAt
                      ? formatDateTime(passkey.lastUsedAt)
                      : t("settings.passkeys.never")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void onDelete(passkey.id)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      {t("settings.passkeys.remove")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
