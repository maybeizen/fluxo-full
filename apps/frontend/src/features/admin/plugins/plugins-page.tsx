import { useAdminPlugins } from "./use-admin-plugins";
import { useUI } from "@/theme-system";

export function PluginsPage() {
  const { AdminPluginsPage } = useUI();
  const model = useAdminPlugins();
  return <AdminPluginsPage model={model} />;
}
