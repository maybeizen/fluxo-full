import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboardPage } from "@/features/admin/admin-dashboard-page";

export const Route = createFileRoute("/_admin/admin/")({
  component: AdminDashboardPage,
});
