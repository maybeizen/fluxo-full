import { ServerIcon } from "lucide-react";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DashboardServicesPanel({ storeTo }: { storeTo: "/store" }) {
  const { DashboardEmptyState } = useUI();
  const t = useT();

  return (
    <DashboardEmptyState
      icon={ServerIcon}
      title={t("dashboard.services.emptyTitle")}
      description={t("dashboard.services.empty")}
      action={{ to: storeTo, label: t("dashboard.services.action") }}
    />
  );
}
