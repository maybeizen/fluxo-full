import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/configurable-options")({
  component: AdminConfigurableOptionsPage,
});

function AdminConfigurableOptionsPage() {
  return (
    <AdminPlaceholderRoute
      title="Configurable Options"
      description="Placeholder for administering configurable options."
    />
  );
}
