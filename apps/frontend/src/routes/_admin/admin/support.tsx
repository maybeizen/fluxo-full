import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/support")({
  component: AdminSupportPage,
});

function AdminSupportPage() {
  return (
    <AdminPlaceholderRoute
      title="Support"
      description="Placeholder for administering support tickets."
    />
  );
}
