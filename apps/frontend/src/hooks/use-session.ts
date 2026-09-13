import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";
import { getAuthSession } from "@/lib/auth-api";
import { authMeQueryKey, type AuthSession } from "@/lib/auth";

const unauthenticated: AuthSession = { status: "unauthenticated" };

export function useSession() {
  const apiUrl = getApiUrl();

  return useQuery({
    queryKey: authMeQueryKey,
    queryFn: getAuthSession,
    enabled: apiUrl !== undefined,
    initialData: apiUrl === undefined ? unauthenticated : undefined,
    staleTime: 30_000,
  });
}
