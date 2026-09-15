import { createFileRoute } from "@tanstack/react-router";
import { PluginsPage } from "@/features/admin/plugins/plugins-page";

export const Route = createFileRoute("/_admin/admin/plugins/")({
  component: AdminPluginsRoute,
});

function AdminPluginsRoute() {
  return <PluginsPage />;
}
