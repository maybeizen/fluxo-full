import {
  PluginContributions,
  toPluginPublicSettings,
  toPluginUserView,
  usePluginExtensions,
} from "@/plugin-system";
import { useAdminUsers } from "@/hooks/use-admin-users";
import { useCreateUser } from "@/hooks/use-create-user";
import { useDeleteUser } from "@/hooks/use-delete-user";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useSession } from "@/hooks/use-session";
import { useT, useUI } from "@/theme-system";

export function UsersPage({ currentUserId }: { currentUserId: string }) {
  const t = useT();
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CreateUserDialog,
    Skeleton,
    UsersTable,
  } = useUI();
  const users = useAdminUsers();
  const create = useCreateUser();
  const del = useDeleteUser();
  const settings = usePublicSettings();
  const session = useSession();
  const listActions = usePluginExtensions("admin.users.listAction");
  const actor =
    session.data?.status === "authenticated" ? session.data.user : undefined;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t("admin.users.title")}</CardTitle>
        <CardDescription>{t("admin.users.description")}</CardDescription>
        <CardAction>
          <CreateUserDialog {...create} />
        </CardAction>
      </CardHeader>
      <CardContent className="pt-4">
        {users.apiUrl === undefined ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.users.missingApi")}
          </p>
        ) : null}
        {users.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {users.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t("admin.users.loadTitle")}</AlertTitle>
            <AlertDescription>{t("admin.users.loadBody")}</AlertDescription>
          </Alert>
        ) : null}
        {users.users && users.users.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.users.empty")}
          </p>
        ) : null}
        {users.users && users.users.length > 0 ? (
          <UsersTable
            users={users.users}
            currentUserId={currentUserId}
            deletingId={del.pendingId}
            onDelete={del.onDelete}
            extraActions={
              actor
                ? (target) => (
                    <PluginContributions
                      contributions={listActions}
                      slotProps={{
                        user: toPluginUserView(actor),
                        targetUser: toPluginUserView(target),
                        settings: toPluginPublicSettings(settings),
                      }}
                    />
                  )
                : undefined
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
