import { MonitorIcon } from "lucide-react";
import { formatDateTime, formatDevice } from "@/features/settings/format";
import type { SessionsSectionModel } from "@/hooks/use-sessions";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function SessionsSection({
  sessions,
  isPending,
  isError,
  loadError,
  hasOthers,
  revokingOne,
  revokingOthers,
  onRevoke,
  onRevokeOthers,
}: SessionsSectionModel) {
  const {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    FieldError,
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{t("settings.sessions.title")}</CardTitle>
            <CardDescription>{t("settings.sessions.description")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!hasOthers || revokingOthers}
            onClick={onRevokeOthers}
          >
            {revokingOthers ? <Spinner data-icon="inline-start" /> : null}
            {t("settings.sessions.revokeOthers")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isError ? <FieldError>{loadError}</FieldError> : null}
        {isPending ? (
          <p className="text-sm text-muted-foreground">{t("settings.sessions.loading")}</p>
        ) : sessions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            <MonitorIcon className="size-4 text-primary" />
            {t("settings.sessions.empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.sessions.column.device")}</TableHead>
                <TableHead>{t("settings.sessions.column.ip")}</TableHead>
                <TableHead>{t("settings.sessions.column.lastSeen")}</TableHead>
                <TableHead>{t("settings.sessions.column.created")}</TableHead>
                <TableHead className="text-right">{t("settings.sessions.column.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex max-w-72 flex-col gap-1">
                      <span className="truncate">{formatDevice(session.userAgent)}</span>
                      {session.current ? (
                        <Badge variant="secondary">{t("settings.sessions.current")}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{session.ip ?? "—"}</TableCell>
                  <TableCell>{formatDateTime(session.lastSeenAt)}</TableCell>
                  <TableCell>{formatDateTime(session.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {session.current ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={revokingOne}
                        onClick={() => onRevoke(session.id)}
                      >
                        {t("settings.sessions.revoke")}
                      </Button>
                    )}
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
