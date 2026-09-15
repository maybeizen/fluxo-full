import { adminNavItems } from "@/components/layout/admin-nav";
import { PluginSlot, usePanelHostContext } from "@/plugin-system";
import { useUI } from "@/theme-system";

export function AdminDashboardPage() {
  const { AdminDashboard } = useUI();
  const { user, settings } = usePanelHostContext();
  return (
    <AdminDashboard
      items={adminNavItems}
      widgets={user ? <PluginSlot point="admin.dashboard.widget" slotProps={{ user, settings }} /> : null}
    />
  );
}
