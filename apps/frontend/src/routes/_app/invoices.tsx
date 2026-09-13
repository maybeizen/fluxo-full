import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholder/placeholder-page";

export const Route = createFileRoute("/_app/invoices")({
  component: InvoicesPage,
});

function InvoicesPage() {
  return (
    <PlaceholderPage
      title="Invoices"
      description="Placeholder for Fluxo invoices and billing history."
    />
  );
}
