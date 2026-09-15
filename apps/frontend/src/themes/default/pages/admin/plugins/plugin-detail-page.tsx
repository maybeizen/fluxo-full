import { Link } from "@tanstack/react-router";
import type { AdminPluginModel } from "@/features/admin/plugins/use-admin-plugin";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminPluginDetailPage({ model }: { model: AdminPluginModel }) {
  const t = useT();
  const {
    AdminPluginConfigForm,
    AdminPluginInstancesCard,
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
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    Spinner,
  } = useUI();

  if (model.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (model.isError || !model.plugin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.plugins.detail.notFoundTitle")}</CardTitle>
          <CardDescription>
            {t("admin.plugins.detail.notFoundDescription")}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            nativeButton={false}
            render={<Link to="/admin/plugins" />}
            variant="outline"
          >
            {t("admin.plugins.detail.back")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const plugin = model.plugin;
  const healthLabel =
    model.health?.status === "ok"
      ? t("admin.plugins.health.ok")
      : model.health?.status === "degraded"
        ? t("admin.plugins.health.degraded")
        : model.health?.status === "unhealthy"
          ? t("admin.plugins.health.unhealthy")
          : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{plugin.name}</CardTitle>
          <CardDescription>
            {t("admin.plugins.detail.metaDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.plugins.column.id")}
              </p>
              <p className="font-mono text-sm">{plugin.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.plugins.column.version")}
              </p>
              <p className="text-sm">{plugin.version}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.plugins.column.type")}
              </p>
              <Badge variant="secondary">{plugin.type}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.plugins.column.status")}
              </p>
              <Badge
                variant={plugin.status === "error" ? "destructive" : "outline"}
              >
                {t(`admin.plugins.status.${plugin.status}`)}
              </Badge>
            </div>
            {plugin.author ? (
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("admin.plugins.detail.author")}
                </p>
                <p className="text-sm">{plugin.author}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.plugins.column.compatibility")}
              </p>
              <Badge
                variant={plugin.compatibility.ok ? "secondary" : "destructive"}
              >
                {plugin.compatibility.ok
                  ? t("admin.plugins.compatible")
                  : t("admin.plugins.incompatible")}
              </Badge>
            </div>
          </div>
          {plugin.description ? (
            <p className="text-sm text-muted-foreground">
              {plugin.description}
            </p>
          ) : null}
          {plugin.error ? (
            <Alert variant="destructive">
              <AlertTitle>{t("admin.plugins.status.error")}</AlertTitle>
              <AlertDescription>{plugin.error}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("admin.plugins.detail.permissions")}
            </p>
            {plugin.permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.plugins.detail.noPermissions")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {plugin.permissions.map((permission) => (
                  <Badge key={permission} variant="outline">
                    {permission}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {model.health ? (
            <Alert
              variant={
                model.health.status === "unhealthy" ? "destructive" : "default"
              }
            >
              <AlertTitle>{healthLabel}</AlertTitle>
              {model.health.message ? (
                <AlertDescription>{model.health.message}</AlertDescription>
              ) : null}
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            render={<Link to="/admin/plugins" />}
            variant="outline"
          >
            {t("admin.plugins.detail.back")}
          </Button>
          {plugin.enabled ? (
            <Button
              type="button"
              variant="outline"
              disabled={model.disablePending}
              onClick={model.onDisable}
            >
              {model.disablePending ? <Spinner /> : null}
              {t("admin.plugins.detail.disable")}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={model.enablePending}
              onClick={model.onEnable}
            >
              {model.enablePending ? <Spinner /> : null}
              {t("admin.plugins.detail.enable")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={model.healthPending}
            onClick={model.onHealth}
          >
            {model.healthPending ? <Spinner /> : null}
            {model.healthPending
              ? t("admin.plugins.detail.checking")
              : t("admin.plugins.detail.health")}
          </Button>
          <Dialog
            open={model.uninstallOpen}
            onOpenChange={model.setUninstallOpen}
          >
            <Button
              type="button"
              variant="destructive"
              onClick={() => model.setUninstallOpen(true)}
            >
              {t("admin.plugins.detail.uninstall")}
            </Button>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {t("admin.plugins.detail.uninstallTitle", {
                    name: plugin.name,
                  })}
                </DialogTitle>
                <DialogDescription>
                  {t("admin.plugins.detail.uninstallDescription")}
                </DialogDescription>
              </DialogHeader>
              <label
                htmlFor="plugin-purge"
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id="plugin-purge"
                  checked={model.purgeStorage}
                  onCheckedChange={(value) =>
                    model.setPurgeStorage(value === true)
                  }
                />
                <span>{t("admin.plugins.detail.purge")}</span>
              </label>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => model.setUninstallOpen(false)}
                >
                  {t("admin.plugins.detail.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={model.uninstallPending}
                  onClick={model.onUninstall}
                >
                  {model.uninstallPending ? <Spinner /> : null}
                  {model.uninstallPending
                    ? t("admin.plugins.detail.uninstalling")
                    : t("admin.plugins.detail.uninstall")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>

      <AdminPluginConfigForm
        model={model.pluginConfigForm}
        title={t("admin.plugins.detail.config")}
        description={t("admin.plugins.detail.configDescription")}
      />

      {model.supportsInstances ? (
        <AdminPluginInstancesCard model={model} />
      ) : null}
    </div>
  );
}
