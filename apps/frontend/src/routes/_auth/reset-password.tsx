import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";
import { readOptionalString } from "@/features/auth/validation";

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token: string | undefined } => ({
    token: readOptionalString(search.token),
  }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { token } = Route.useSearch();
  return <ResetPasswordPage token={token} />;
}
