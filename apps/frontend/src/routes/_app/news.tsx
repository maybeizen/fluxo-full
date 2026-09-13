import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholder/placeholder-page";

export const Route = createFileRoute("/_app/news")({
  component: NewsPage,
});

function NewsPage() {
  return (
    <PlaceholderPage
      title="News"
      description="Placeholder for Fluxo product updates and announcements."
    />
  );
}
