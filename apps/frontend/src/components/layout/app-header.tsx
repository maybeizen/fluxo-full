import { useRouterState } from "@tanstack/react-router";
import { useUI } from "@/registry/ui-provider";

function titleForPath(pathname: string): string {
  if (pathname === "/settings") {
    return "Settings";
  }
  return "Dashboard";
}

export function AppHeader() {
  const { Separator, SidebarTrigger } = useUI();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <header className="flex h-12 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <h1 className="text-sm font-medium">{titleForPath(pathname)}</h1>
    </header>
  );
}
