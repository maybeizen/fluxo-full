import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboardIcon, SettingsIcon } from "lucide-react";
import { useUI } from "@/registry/ui-provider";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppSidebar() {
  const {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
  } = useUI();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <span className="font-heading text-sm font-medium">Fluxo</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={pathname === item.to}
                      tooltip={item.label}
                      render={<Link to={item.to} />}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
