import { createFileRoute } from "@tanstack/react-router";
import { UserEditPage } from "@/features/admin/users/user-edit-page";
import { Route as AdminRoute } from "@/routes/_admin";

export const Route = createFileRoute("/_admin/admin/users/$id")({
  component: AdminUserEditRoute,
});

function AdminUserEditRoute() {
  const { id } = Route.useParams();
  const { session } = AdminRoute.useRouteContext();
  return <UserEditPage userId={id} currentUserId={session.user.id} />;
}
