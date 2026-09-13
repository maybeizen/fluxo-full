import { PlaceholderPage } from "@/features/placeholder/placeholder-page";

export function AdminPlaceholderRoute({ title, description }: { title: string; description: string }) {
  return <PlaceholderPage title={title} description={description} />;
}
