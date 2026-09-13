import { createFileRoute } from "@tanstack/react-router";
import { ConfirmEmailPage } from "@/features/auth/confirm-email-page";
import { readOptionalString } from "@/features/auth/validation";

export const Route = createFileRoute("/_auth/confirm-email")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { status?: "waiting" | "success"; token?: string } => {
    const token = readOptionalString(search.token);
    if (search.status === "success") {
      return { status: "success", token };
    }
    return { token };
  },
  component: ConfirmEmailRoute,
});

function ConfirmEmailRoute() {
  const { status, token } = Route.useSearch();
  return <ConfirmEmailPage status={status ?? "waiting"} token={token} />;
}
