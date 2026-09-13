import { useQueryClient } from "@tanstack/react-query";
import { authMeQueryKey, type PublicUser } from "@/lib/auth";

export function useRefreshSession() {
  const queryClient = useQueryClient();

  return async (user?: PublicUser): Promise<void> => {
    if (user) {
      queryClient.setQueryData(authMeQueryKey, { status: "authenticated", user });
    }
    await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
  };
}
