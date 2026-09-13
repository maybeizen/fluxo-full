import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/categories")({
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  return (
    <AdminPlaceholderRoute
      title="Categories"
      description="Placeholder for administering product categories."
    />
  );
}
