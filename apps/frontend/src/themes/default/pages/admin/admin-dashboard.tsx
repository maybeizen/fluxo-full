import { Link } from "@tanstack/react-router";
import type { AdminNavItem } from "@/components/layout/admin-nav";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminDashboard({ items }: { items: readonly AdminNavItem[] }) {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle } = useUI();
  const links = items.filter((item) => item.to !== "/admin");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.dashboard.title")}</CardTitle>
          <CardDescription>{t("admin.dashboard.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
