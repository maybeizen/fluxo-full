import {
  LayersIcon,
  LifeBuoyIcon,
  NewspaperIcon,
  ReceiptIcon,
  type LucideIcon,
} from "lucide-react";

export type DashboardTabId = "services" | "invoices" | "news" | "support";

export interface DashboardTabItem {
  id: DashboardTabId;
  labelKey: string;
  icon: LucideIcon;
}

export type DashboardProfileLinkId = "docs" | "discord" | "support";

export interface DashboardProfileLink {
  id: DashboardProfileLinkId;
  href: string;
  labelKey: string;
  external: boolean;
}

export const dashboardTabs: readonly DashboardTabItem[] = [
  { id: "services", labelKey: "dashboard.tabs.services", icon: LayersIcon },
  { id: "invoices", labelKey: "dashboard.tabs.invoices", icon: ReceiptIcon },
  { id: "news", labelKey: "dashboard.tabs.news", icon: NewspaperIcon },
  { id: "support", labelKey: "dashboard.tabs.support", icon: LifeBuoyIcon },
];

export const dashboardCtaTo = "/store" as const;
export const dashboardProfileTo = "/settings" as const;
export const dashboardSupportTo = "/support" as const;

export function getDashboardProfileLinks(supportTicketsEnabled: boolean): DashboardProfileLink[] {
  const links: DashboardProfileLink[] = [
    { id: "docs", href: "/#docs", labelKey: "dashboard.links.docs", external: false },
    { id: "discord", href: "https://discord.com", labelKey: "dashboard.links.discord", external: true },
  ];
  if (supportTicketsEnabled) {
    links.push({
      id: "support",
      href: "/support",
      labelKey: "dashboard.links.support",
      external: false,
    });
  }
  return links;
}
