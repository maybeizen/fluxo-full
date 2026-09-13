import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuthenticatedSession } from "@/features/auth/guards";
import { MaintenancePage } from "@/features/auth/maintenance-page";
import { SuspendedPage } from "@/features/auth/suspended-page";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { isAdminRole } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await requireAuthenticatedSession();
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();
  const settings = usePublicSettings();
  if (session.user.suspended) {
    return <SuspendedPage user={session.user} />;
  }
  if (settings.appMaintenanceModeEnabled && !isAdminRole(session.user.role)) {
    return <MaintenancePage />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
