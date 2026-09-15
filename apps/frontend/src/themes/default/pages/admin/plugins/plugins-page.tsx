import type { AdminPluginsModel } from "@/features/admin/plugins/use-admin-plugins";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminPluginsPage({ model }: { model: AdminPluginsModel }) {
  const t = useT();
  const {
    AdminPluginsTable,
    Alert,
    AlertDescription,
    AlertTitle,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Skeleton,
  } = useUI();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t("admin.plugins.title")}</CardTitle>
        <CardDescription>{t("admin.plugins.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <Alert>
          <AlertTitle>{t("admin.plugins.trustTitle")}</AlertTitle>
          <AlertDescription>{t("admin.plugins.trust")}</AlertDescription>
        </Alert>
        {model.apiUrl === undefined ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.plugins.missingApi")}
          </p>
        ) : null}
        {model.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {model.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t("admin.plugins.loadTitle")}</AlertTitle>
            <AlertDescription>{t("admin.plugins.loadBody")}</AlertDescription>
          </Alert>
        ) : null}
        {model.plugins && model.plugins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.plugins.empty")}
          </p>
        ) : null}
        {model.plugins && model.plugins.length > 0 ? (
          <AdminPluginsTable plugins={model.plugins} />
        ) : null}
      </CardContent>
    </Card>
  );
}
