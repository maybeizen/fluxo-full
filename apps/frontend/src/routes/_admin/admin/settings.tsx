import { createFileRoute } from "@tanstack/react-router";
import { AdminSettingsPage } from "@/features/admin/settings/settings-page";

export const Route = createFileRoute("/_admin/admin/settings")({
  component: AdminSettingsPage,
});
