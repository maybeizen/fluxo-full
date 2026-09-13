import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholder/placeholder-page";

export const Route = createFileRoute("/_app/services")({
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <PlaceholderPage
      title="Services"
      description="Placeholder for Fluxo service management."
    />
  );
}
