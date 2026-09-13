import { useUI } from "@/registry/ui-provider";

export interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle } = useUI();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">This section is coming soon.</p>
      </CardContent>
    </Card>
  );
}
