import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/invoices")({
  component: AdminInvoicesPage,
});

function AdminInvoicesPage() {
  return (
    <AdminPlaceholderRoute
      title="Invoices"
      description="Placeholder for administering invoices."
    />
  );
}
