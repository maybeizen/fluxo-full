import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  LayoutDashboardIcon,
  ServerIcon,
  SettingsIcon,
  ShieldIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { isAdminPath } from "@/components/layout/admin-nav";
import { useSession } from "@/hooks/use-session";
import { logout } from "@/lib/auth-api";
import { authMeQueryKey, isAdminRole, type PublicUser } from "@/lib/auth";
import { useT } from "@/theme-system/use-t";

export interface AccountMenuItem {
  to: "/dashboard" | "/servers" | "/settings" | "/admin";
  label: string;
  icon: LucideIcon;
}

export interface AccountMenu {
  user?: PublicUser;
  items: AccountMenuItem[];
  extraItems?: ReactNode;
  onSignOut: () => void;
  isPending: boolean;
}

export function useAccountMenu(): AccountMenu {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const session = useSession();
  const user =
    session.data?.status === "authenticated" ? session.data.user : undefined;
  const inAdmin = isAdminPath(pathname);

  const items: AccountMenuItem[] = [];
  if (user) {
    items.push(
      {
        to: "/dashboard",
        label: t("account.dashboard"),
        icon: LayoutDashboardIcon,
      },
      { to: "/servers", label: t("account.servers"), icon: ServerIcon },
      { to: "/settings", label: t("account.settings"), icon: SettingsIcon },
    );
    if (isAdminRole(user.role)) {
      items.push(
        inAdmin
          ? {
              to: "/dashboard",
              label: t("account.leaveAdmin"),
              icon: ArrowLeftIcon,
            }
          : { to: "/admin", label: t("account.admin"), icon: ShieldIcon },
      );
    }
  }

  async function handleSignOut(): Promise<void> {
    try {
      await logout();
    } catch {
      toast.error(t("account.signOutError"));
      return;
    }

    queryClient.setQueryData(authMeQueryKey, { status: "unauthenticated" });
    await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
    void navigate({ to: "/" });
  }

  return {
    user,
    items,
    onSignOut: () => {
      void handleSignOut();
    },
    isPending: session.isPending && !session.data,
  };
}
