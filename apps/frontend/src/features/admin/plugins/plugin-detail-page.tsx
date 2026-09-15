import { useAdminPlugin } from "./use-admin-plugin";
import { useUI } from "@/theme-system";

export function PluginDetailPage({ pluginId }: { pluginId: string }) {
  const { AdminPluginDetailPage } = useUI();
  const model = useAdminPlugin(pluginId);
  return <AdminPluginDetailPage model={model} />;
}
