import { createFileRoute } from "@tanstack/react-router";
import { PluginDetailPage } from "@/features/admin/plugins/plugin-detail-page";

export const Route = createFileRoute("/_admin/admin/plugins/$pluginId")({
  component: AdminPluginDetailRoute,
});

function AdminPluginDetailRoute() {
  const { pluginId } = Route.useParams();
  return <PluginDetailPage pluginId={pluginId} />;
}
