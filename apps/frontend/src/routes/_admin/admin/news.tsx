import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderRoute } from "@/features/admin/admin-placeholder-route";

export const Route = createFileRoute("/_admin/admin/news")({
  component: AdminNewsPage,
});

function AdminNewsPage() {
  return (
    <AdminPlaceholderRoute
      title="News"
      description="Placeholder for administering news posts."
    />
  );
}
