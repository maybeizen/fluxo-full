import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/coupons")({
  component: AdminCouponsPage,
});

function AdminCouponsPage() {
  return (
    <AdminPlaceholderRoute
      title="Coupons"
      description="Placeholder for administering coupons."
    />
  );
}
