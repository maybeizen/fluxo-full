import type { CrumbItem } from "@/components/layout/app-nav";
import { useUI } from "@/theme-system/use-ui";

export interface AppHeaderProps {
  homeTo: "/dashboard" | "/admin";
  crumbs: CrumbItem[];
}

export function AppHeader({ homeTo, crumbs }: AppHeaderProps) {
  const { Breadcrumbs, SidebarTrigger } = useUI();

  return (
    <header className="flex h-12 items-center gap-3 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      <Breadcrumbs homeTo={homeTo} items={crumbs} />
    </header>
  );
}
