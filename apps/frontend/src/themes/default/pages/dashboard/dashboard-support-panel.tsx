import { LifeBuoyIcon } from "lucide-react";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DashboardSupportPanel({ supportTo }: { supportTo?: "/support" }) {
  const { DashboardEmptyState } = useUI();
  const t = useT();

  return (
    <DashboardEmptyState
      icon={LifeBuoyIcon}
      title={t("dashboard.support.emptyTitle")}
      description={t("dashboard.support.empty")}
      action={
        supportTo
          ? { to: supportTo, label: t("dashboard.support.action") }
          : undefined
      }
    />
  );
}
