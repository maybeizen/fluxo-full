import { useUI } from "@/registry/ui-provider";

export function SettingsPage() {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } =
    useUI();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Placeholder settings for the Fluxo workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <Label htmlFor="instance-name">Instance name</Label>
          <Input id="instance-name" defaultValue="Fluxo" disabled />
        </div>
      </CardContent>
    </Card>
  );
}
