import type { ReactNode } from "react";
import type { CrumbItem, SidebarNavItem } from "@/components/layout/app-nav";
import type { AccountMenu } from "@/hooks/use-account-menu";
import { useUIStore } from "@/stores/ui";
import { useUI } from "@/theme-system/use-ui";

export interface AppShellProps {
  children: ReactNode;
  navItems: readonly SidebarNavItem[];
  accountMenu: AccountMenu;
  crumbs: CrumbItem[];
  homeTo: "/dashboard" | "/admin";
}

export function AppShell({ children, navItems, accountMenu, crumbs, homeTo }: AppShellProps) {
  const { AppHeader, AppSidebar, SidebarInset, SidebarProvider } = useUI();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar items={navItems} accountMenu={accountMenu} />
      <SidebarInset>
        <AppHeader homeTo={homeTo} crumbs={crumbs} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
