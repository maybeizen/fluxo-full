import { Link } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import type { AdminPluginListItem } from "@/features/admin/plugins/types";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

function statusLabel(status: AdminPluginListItem["status"], t: (key: string) => string): string {
  if (status === "installed") {
    return t("admin.plugins.status.installed");
  }
  if (status === "disabled") {
    return t("admin.plugins.status.disabled");
  }
  if (status === "enabled") {
    return t("admin.plugins.status.enabled");
  }
  if (status === "started") {
    return t("admin.plugins.status.started");
  }
  return t("admin.plugins.status.error");
}

export function AdminPluginsTable({ plugins }: { plugins: AdminPluginListItem[] }) {
  const t = useT();
  const {
    Badge,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } = useUI();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.plugins.column.name")}</TableHead>
          <TableHead>{t("admin.plugins.column.id")}</TableHead>
          <TableHead>{t("admin.plugins.column.type")}</TableHead>
          <TableHead>{t("admin.plugins.column.version")}</TableHead>
          <TableHead>{t("admin.plugins.column.status")}</TableHead>
          <TableHead>{t("admin.plugins.column.enabled")}</TableHead>
          <TableHead>{t("admin.plugins.column.compatibility")}</TableHead>
          <TableHead className="text-right">{t("admin.plugins.column.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plugins.map((plugin) => (
          <TableRow key={plugin.id}>
            <TableCell>
              <span className="font-medium">{plugin.name}</span>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{plugin.id}</TableCell>
            <TableCell>
              <Badge variant="secondary">{plugin.type}</Badge>
            </TableCell>
            <TableCell>{plugin.version}</TableCell>
            <TableCell>
              <Badge variant={plugin.status === "error" ? "destructive" : "outline"}>
                {statusLabel(plugin.status, t)}
              </Badge>
            </TableCell>
            <TableCell>
              {plugin.enabled ? t("admin.plugins.enabled") : t("admin.plugins.disabled")}
            </TableCell>
            <TableCell>
              <Badge variant={plugin.compatibility.ok ? "secondary" : "destructive"}>
                {plugin.compatibility.ok
                  ? t("admin.plugins.compatible")
                  : t("admin.plugins.incompatible")}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <IconButton
                  label={t("admin.plugins.view")}
                  nativeButton={false}
                  render={<Link to="/admin/plugins/$pluginId" params={{ pluginId: plugin.id }} />}
                >
                  <PencilIcon />
                </IconButton>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
