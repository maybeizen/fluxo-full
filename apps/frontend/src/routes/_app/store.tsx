import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholder/placeholder-page";

export const Route = createFileRoute("/_app/store")({
  component: StorePage,
});

function StorePage() {
  return (
    <PlaceholderPage title="Store" description="Placeholder for the Fluxo store." />
  );
}
