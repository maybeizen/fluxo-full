import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminUsersQueryKey, deleteAdminUser } from "@/features/admin/api";
import type { AdminUserListItem } from "@/features/admin/types";
import { AuthApiError } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export function useDeleteUser() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (user: AdminUserListItem) => deleteAdminUser(user.id),
    onSuccess: async (_result, user) => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
      toast.success(t("admin.delete.deleted", { username: user.username }));
    },
    onError: (error) => {
      toast.error(error instanceof AuthApiError ? error.message : t("admin.delete.unable"));
    },
  });

  return {
    pending: deleteMutation.isPending,
    pendingId: deleteMutation.isPending ? deleteMutation.variables?.id : undefined,
    onDelete: (user: AdminUserListItem) => deleteMutation.mutate(user),
  };
}

export type DeleteUserModel = ReturnType<typeof useDeleteUser>;
