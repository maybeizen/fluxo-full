import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { SidebarNavItem } from "@/components/layout/app-nav";
import { BrandLabel } from "@/components/layout/brand-mark";
import type { AccountMenu } from "@/hooks/use-account-menu";
import { cn } from "@/lib/cn";
import { useUI } from "@/theme-system/use-ui";

export interface AppSidebarProps {
  items: readonly SidebarNavItem[];
  extraNav?: ReactNode;
  accountMenu: AccountMenu;
}

export function AppSidebar({ items, extraNav, accountMenu }: AppSidebarProps) {
  const {
    AvatarDropdown,
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarTrigger,
    Skeleton,
  } = useUI();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const user = accountMenu.user;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative p-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-primary/35">
        <div className="flex h-9 items-center gap-3 px-2.5 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2!">
          <BrandLabel className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden" />
          <SidebarTrigger className="ml-auto shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground group-data-[collapsible=icon]:ml-0" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {items.map((item) => {
                const Icon = item.icon;
                const path = pathname.replace(/\/$/, "") || "/";
                const isActive =
                  item.to === "/admin"
                    ? path === "/admin"
                    : path === item.to || path.startsWith(`${item.to}/`);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link to={item.to} />}
                      className={cn(
                        "h-9 gap-3 rounded-lg px-2.5 text-[13px] font-medium tracking-tight text-sidebar-foreground/75",
                        "hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
                        "data-active:bg-primary/10 data-active:font-medium data-active:text-primary",
                        "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2!",
                      )}
                    >
                      <Icon />
                      <span className="group-data-[collapsible=icon]:sr-only">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {extraNav}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        {user ? (
          <AvatarDropdown
            user={user}
            items={accountMenu.items}
            extraItems={accountMenu.extraItems}
            onSignOut={accountMenu.onSignOut}
            className="w-full"
          />
        ) : (
          <Skeleton className="h-10 w-full group-data-[collapsible=icon]:size-8" />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
