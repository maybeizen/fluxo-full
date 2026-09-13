import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listSessions, revokeOtherSessions, revokeSession } from "@/lib/auth-api";
import { AuthApiError, authSessionsQueryKey } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export function useSessions() {
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: authSessionsQueryKey,
    queryFn: listSessions,
  });

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey });
      toast.success(t("settings.sessions.revoked"));
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError ? error.message : t("settings.sessions.revokeUnable"),
      );
    },
  });

  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey });
      toast.success(t("settings.sessions.othersRevoked"));
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError ? error.message : t("settings.sessions.othersUnable"),
      );
    },
  });

  const sessions = sessionsQuery.data ?? [];

  return {
    sessions,
    isPending: sessionsQuery.isPending,
    isError: sessionsQuery.isError,
    loadError:
      sessionsQuery.isError
        ? sessionsQuery.error instanceof AuthApiError
          ? sessionsQuery.error.message
          : t("settings.sessions.loadUnable")
        : undefined,
    hasOthers: sessions.some((session) => !session.current),
    revokingOne: revokeOne.isPending,
    revokingOthers: revokeOthers.isPending,
    onRevoke: (id: string) => revokeOne.mutate(id),
    onRevokeOthers: () => revokeOthers.mutate(),
  };
}

export type SessionsSectionModel = ReturnType<typeof useSessions>;
