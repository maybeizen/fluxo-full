import { ReceiptIcon } from "lucide-react";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DashboardInvoicesPanel() {
  const { DashboardEmptyState } = useUI();
  const t = useT();

  return (
    <DashboardEmptyState
      icon={ReceiptIcon}
      title={t("dashboard.invoices.emptyTitle")}
      description={t("dashboard.invoices.empty")}
    />
  );
}
