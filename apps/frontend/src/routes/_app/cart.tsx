import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholder/placeholder-page";

export const Route = createFileRoute("/_app/cart")({
  component: CartPage,
});

function CartPage() {
  return (
    <PlaceholderPage title="Cart" description="Placeholder for the Fluxo checkout cart." />
  );
}
