import type { ReactNode } from "react";
import { useUIStore } from "@/stores/ui";
import { useUI } from "@/registry/ui-provider";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { SidebarInset, SidebarProvider } = useUI();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
