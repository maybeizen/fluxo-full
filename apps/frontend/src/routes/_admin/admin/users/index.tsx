import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/features/admin/users/users-page";
import { Route as AdminRoute } from "@/routes/_admin";

export const Route = createFileRoute("/_admin/admin/users/")({
  component: AdminUsersRoute,
});

function AdminUsersRoute() {
  const { session } = AdminRoute.useRouteContext();
  return <UsersPage currentUserId={session.user.id} />;
}
