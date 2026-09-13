import { useQuery } from "@tanstack/react-query";
import { fetchHealth, getApiUrl } from "@/lib/api";
import { useUI } from "@/registry/ui-provider";

export function DashboardPage() {
  const { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } =
    useUI();
  const apiUrl = getApiUrl();
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const url = getApiUrl();
      if (!url) {
        throw new Error("VITE_PUBLIC_API_URL is not set");
      }
      return fetchHealth(url);
    },
    enabled: apiUrl !== undefined,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>Working shell for the Fluxo control plane.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {apiUrl === undefined ? (
          <p className="text-muted-foreground">
            Set VITE_PUBLIC_API_URL to query API health.
          </p>
        ) : null}
        {apiUrl !== undefined && healthQuery.isPending ? (
          <Skeleton className="h-6 w-32" />
        ) : null}
        {healthQuery.isError ? (
          <Badge variant="destructive">Unreachable</Badge>
        ) : null}
        {healthQuery.data ? (
          <div className="flex items-center gap-2">
            <Badge>{healthQuery.data.status}</Badge>
            <span className="text-muted-foreground">{healthQuery.data.service}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
