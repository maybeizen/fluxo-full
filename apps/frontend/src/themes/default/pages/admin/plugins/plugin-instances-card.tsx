import type { AdminPluginModel } from "@/features/admin/plugins/use-admin-plugin";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminPluginInstancesCard({ model }: { model: AdminPluginModel }) {
  const t = useT();
  const {
    AdminPluginConfigForm,
    Badge,
    Button,
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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
    Skeleton,
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
      <CardHeader className="border-b">
        <CardTitle>{t("admin.plugins.instances.title")}</CardTitle>
        <CardDescription>{t("admin.plugins.instances.description")}</CardDescription>
        <CardAction>
          <Dialog open={model.createOpen} onOpenChange={model.setCreateOpen}>
            <DialogTrigger render={<Button />}>{t("admin.plugins.instances.create")}</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form className="flex flex-col gap-4" onSubmit={model.onCreateInstance}>
                <DialogHeader>
                  <DialogTitle>{t("admin.plugins.instances.createTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.plugins.instances.createDescription")}
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  {model.createError ? <FieldError>{model.createError}</FieldError> : null}
                  <Field>
                    <FieldLabel htmlFor="plugin-instance-name">
                      {t("admin.plugins.instances.displayName")}
                    </FieldLabel>
                    <Input
                      id="plugin-instance-name"
                      value={model.createName}
                      onChange={(event) => model.setCreateName(event.target.value)}
                    />
                  </Field>
                  <label htmlFor="plugin-instance-enabled" className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="plugin-instance-enabled"
                      checked={model.createEnabled}
                      onCheckedChange={(value) => model.setCreateEnabled(value === true)}
                    />
                    <span>{t("admin.plugins.instances.enabled")}</span>
                  </label>
                </FieldGroup>
                <DialogFooter>
                  <Button type="submit" disabled={model.createPending}>
                    {model.createPending ? <Spinner /> : null}
                    {model.createPending
                      ? t("admin.plugins.instances.creating")
                      : t("admin.plugins.instances.submit")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        {model.instancesPending ? (
          <Skeleton className="h-10 w-full" />
        ) : null}
        {model.instances.length === 0 && !model.instancesPending ? (
          <p className="text-sm text-muted-foreground">{t("admin.plugins.instances.empty")}</p>
        ) : null}
        {model.instances.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.plugins.instances.column.name")}</TableHead>
                <TableHead>{t("admin.plugins.instances.column.id")}</TableHead>
                <TableHead>{t("admin.plugins.instances.column.enabled")}</TableHead>
                <TableHead className="text-right">
                  {t("admin.plugins.instances.column.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.instances.map((instance) => (
                <TableRow key={instance.id}>
                  <TableCell className="font-medium">{instance.displayName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {instance.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant={instance.enabled ? "default" : "secondary"}>
                      {instance.enabled ? t("admin.plugins.enabled") : t("admin.plugins.disabled")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        variant={model.selectedInstanceId === instance.id ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => model.setSelectedInstanceId(instance.id)}
                      >
                        {t("admin.plugins.instances.config")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={model.instanceActionPending}
                        onClick={() => model.onSetInstanceEnabled(instance.id, !instance.enabled)}
                      >
                        {instance.enabled
                          ? t("admin.plugins.instances.disable")
                          : t("admin.plugins.instances.enable")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={model.instanceActionPending}
                        onClick={() => model.onDeleteInstance(instance.id)}
                      >
                        {t("admin.plugins.instances.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {model.selectedInstanceId ? (
          model.instanceConfigPending ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <AdminPluginConfigForm
              model={model.instanceConfigForm}
              title={t("admin.plugins.instances.configTitle")}
              description={t("admin.plugins.instances.configDescription")}
            />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
