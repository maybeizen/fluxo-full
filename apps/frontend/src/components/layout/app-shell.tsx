import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  appNavItems,
  crumbsForPath,
  homePathFor,
  type SidebarNavItem,
} from "@/components/layout/app-nav";
import { useAccountMenu } from "@/hooks/use-account-menu";
import { usePublicSettings } from "@/hooks/use-public-settings";
import {
  PluginSlot,
  toPluginPublicSettings,
  toPluginUserView,
} from "@/plugin-system";
import { useUI } from "@/theme-system";

export interface AppShellProps {
  children: ReactNode;
  navItems?: readonly SidebarNavItem[];
  extraNav?: ReactNode;
}

export function AppShell({
  children,
  navItems = appNavItems,
  extraNav,
}: AppShellProps) {
  const { AppShell: ThemeAppShell } = useUI();
  const accountMenu = useAccountMenu();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const settings = usePublicSettings();
  const extraItems = accountMenu.user ? (
    <PluginSlot
      point="client.shell.accountMenu"
      slotProps={{
        user: toPluginUserView(accountMenu.user),
        settings: toPluginPublicSettings(settings),
      }}
    />
  ) : undefined;

  return (
    <ThemeAppShell
      navItems={navItems}
      extraNav={extraNav}
      accountMenu={{ ...accountMenu, extraItems }}
      crumbs={crumbsForPath(pathname)}
      homeTo={homePathFor(pathname)}
    >
      {settings.appGlobalBannerAnnouncementEnabled &&
      settings.appGlobalBannerAnnouncementMessage.trim().length > 0 ? (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-foreground">
          {settings.appGlobalBannerAnnouncementMessage}
        </div>
      ) : null}
      {children}
    </ThemeAppShell>
  );
}
