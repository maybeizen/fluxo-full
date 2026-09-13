import { adminNavItems } from "@/components/layout/admin-nav";
import { useUI } from "@/theme-system";

export function AdminDashboardPage() {
  const { AdminDashboard } = useUI();
  return <AdminDashboard items={adminNavItems} />;
}
