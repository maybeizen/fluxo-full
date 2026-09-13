import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/plugins")({
  component: AdminPluginsPage,
});

function AdminPluginsPage() {
  return (
    <AdminPlaceholderRoute
      title="Plugins"
      description="Placeholder for administering plugins."
    />
  );
}
