export const PANEL_EXTENSION_POINTS = [
  "client.shell.accountMenu",
  "client.dashboard.services",
  "client.dashboard.invoices",
  "client.dashboard.news",
  "client.dashboard.support",
  "client.settings.section",
  "admin.dashboard.widget",
  "admin.nav.item",
  "admin.users.listAction",
  "admin.users.detailSection",
  "admin.settings.section",
  "auth.login.extra",
] as const;

export type PanelExtensionPoint = (typeof PANEL_EXTENSION_POINTS)[number];

export interface PanelContribution {
  pluginId: string;
  point: PanelExtensionPoint;
  contributionId: string;
  title?: string;
  order?: number;
}

export interface PanelContributionManifest {
  point: PanelExtensionPoint;
  contributionId: string;
  title?: string;
  order?: number;
}

export interface PanelFrontendModule {
  contributions: readonly PanelContributionManifest[];
}

export interface PanelExtensionRegistry {
  list(point?: PanelExtensionPoint): readonly PanelContribution[];
  register(contribution: PanelContribution): void;
}
