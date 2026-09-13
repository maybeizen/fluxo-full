import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/services")({
  component: AdminServicesPage,
});

function AdminServicesPage() {
  return (
    <AdminPlaceholderRoute
      title="Services"
      description="Placeholder for administering customer services."
    />
  );
}
