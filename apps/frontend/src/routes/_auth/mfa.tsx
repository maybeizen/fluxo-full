import { createFileRoute } from "@tanstack/react-router";
import { MfaPage } from "@/features/auth/mfa-page";

export const Route = createFileRoute("/_auth/mfa")({
  component: MfaPage,
});
