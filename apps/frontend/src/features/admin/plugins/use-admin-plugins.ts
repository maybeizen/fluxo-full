import { useQuery } from "@tanstack/react-query";
import { adminPluginsQueryKey, listAdminPlugins } from "./api";
import { getApiUrl } from "@/lib/api";

export function useAdminPlugins() {
  const apiUrl = getApiUrl();
  const query = useQuery({
    queryKey: adminPluginsQueryKey,
    queryFn: listAdminPlugins,
    enabled: apiUrl !== undefined,
  });

  return {
    apiUrl,
    plugins: query.data,
    isPending: query.isPending,
    isError: query.isError,
  };
}

export type AdminPluginsModel = ReturnType<typeof useAdminPlugins>;
