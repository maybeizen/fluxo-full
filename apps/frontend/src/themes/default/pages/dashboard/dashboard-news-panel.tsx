import { NewspaperIcon } from "lucide-react";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DashboardNewsPanel() {
  const { DashboardEmptyState } = useUI();
  const t = useT();

  return (
    <DashboardEmptyState
      icon={NewspaperIcon}
      title={t("dashboard.news.emptyTitle")}
      description={t("dashboard.news.empty")}
    />
  );
}
