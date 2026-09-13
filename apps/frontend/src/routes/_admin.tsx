import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { adminNavItems } from "@/components/layout/admin-nav";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuthenticatedSession } from "@/features/auth/guards";
import { SuspendedPage } from "@/features/auth/suspended-page";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { isAdminRole } from "@/lib/auth";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async () => {
    const session = await requireAuthenticatedSession();
    if (!isAdminRole(session.user.role)) {
      throw redirect({ to: "/dashboard" });
    }
    return { session };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { session } = Route.useRouteContext();
  const settings = usePublicSettings();
  if (session.user.suspended) {
    return <SuspendedPage user={session.user} />;
  }
  const navItems = settings.appSupportTicketsEnabled
    ? adminNavItems
    : adminNavItems.filter((item) => item.to !== "/admin/support");
  return (
    <AppShell navItems={navItems}>
      <Outlet />
    </AppShell>
  );
}
