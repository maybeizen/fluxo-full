import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_PUBLIC_SETTINGS,
  fetchPublicSettings,
  publicSettingsQueryKey,
} from "@/lib/public-settings";

export function usePublicSettings() {
  const query = useQuery({
    queryKey: publicSettingsQueryKey,
    queryFn: fetchPublicSettings,
    staleTime: 30_000,
  });
  return query.data ?? DEFAULT_PUBLIC_SETTINGS;
}
