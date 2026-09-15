import type { ComponentType } from "react";
import type {
  PanelContribution,
  PanelExtensionPoint,
  PluginPublicSettingsView,
  PluginUserView,
} from "@fluxo/forge";

export interface PanelContributionBaseProps {
  pluginId: string;
  contributionId: string;
  settings: PluginPublicSettingsView;
}

export type PanelContributionPropsMap = {
  "client.shell.accountMenu": PanelContributionBaseProps & { user: PluginUserView };
  "client.dashboard.services": PanelContributionBaseProps & { user: PluginUserView };
  "client.dashboard.invoices": PanelContributionBaseProps & { user: PluginUserView };
  "client.dashboard.news": PanelContributionBaseProps & { user: PluginUserView };
  "client.dashboard.support": PanelContributionBaseProps & { user: PluginUserView };
  "client.settings.section": PanelContributionBaseProps & { user: PluginUserView };
  "admin.dashboard.widget": PanelContributionBaseProps & { user: PluginUserView };
  "admin.nav.item": PanelContributionBaseProps & { user: PluginUserView };
  "admin.users.listAction": PanelContributionBaseProps & {
    user: PluginUserView;
    targetUser: PluginUserView;
  };
  "admin.users.detailSection": PanelContributionBaseProps & {
    user: PluginUserView;
    targetUser: PluginUserView;
  };
  "admin.settings.section": PanelContributionBaseProps & { user: PluginUserView };
  "auth.login.extra": PanelContributionBaseProps;
};

export type PanelSlotProps<P extends PanelExtensionPoint> = Omit<
  PanelContributionPropsMap[P],
  "pluginId" | "contributionId"
>;

export interface FrontendPanelContribution<P extends PanelExtensionPoint = PanelExtensionPoint>
  extends PanelContribution {
  point: P;
  component?: ComponentType<PanelContributionPropsMap[P]>;
}

export interface PanelPluginRegistrationApi {
  register: <P extends PanelExtensionPoint>(
    contribution: FrontendPanelContribution<P> & {
      component: ComponentType<PanelContributionPropsMap[P]>;
    },
  ) => void;
}

export interface PanelPluginModule {
  pluginId?: string;
  register?: (api: PanelPluginRegistrationApi) => void;
}

export type PanelPluginLoader = () => Promise<unknown>;

export type ResolvablePanelCatalog = Record<string, PanelPluginLoader>;
