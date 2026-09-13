import { useQuery } from "@tanstack/react-query";
import { adminUsersQueryKey, listAdminUsers } from "@/features/admin/api";
import { getApiUrl } from "@/lib/api";

export function useAdminUsers() {
  const apiUrl = getApiUrl();
  const usersQuery = useQuery({
    queryKey: adminUsersQueryKey,
    queryFn: listAdminUsers,
    enabled: apiUrl !== undefined,
  });

  return {
    apiUrl,
    users: usersQuery.data,
    isPending: usersQuery.isPending,
    isError: usersQuery.isError,
  };
}

export type AdminUsersModel = ReturnType<typeof useAdminUsers>;
