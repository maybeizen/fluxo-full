import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/products")({
  component: AdminProductsPage,
});

function AdminProductsPage() {
  return (
    <AdminPlaceholderRoute
      title="Products"
      description="Placeholder for administering store products."
    />
  );
}
