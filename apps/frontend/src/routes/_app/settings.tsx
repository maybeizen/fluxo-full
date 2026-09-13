import { createFileRoute } from "@tanstack/react-router";
import { parseSettingsSearch } from "@/features/settings/search";
import { SettingsPage } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_app/settings")({
  validateSearch: parseSettingsSearch,
  component: SettingsRoute,
});

function SettingsRoute() {
  const search = Route.useSearch();
  return <SettingsPage tab={search.tab} token={search.token} />;
}
