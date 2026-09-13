import { useUI } from "@/registry/ui-provider";

export function ServersPage() {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle } = useUI();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servers</CardTitle>
        <CardDescription>Placeholder for the Fluxo server inventory.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No servers are connected yet.</p>
      </CardContent>
    </Card>
  );
}
