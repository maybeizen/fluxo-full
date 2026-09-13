import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthSession } from "@/lib/auth-api";
import { useUI } from "@/theme-system";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (session.status === "authenticated") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPathlessLayout,
});

function AuthPathlessLayout() {
  const { AuthLayout } = useUI();

  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
