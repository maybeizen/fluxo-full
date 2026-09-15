export interface PluginPublicSettingsView {
  appName: string;
  appBaseUrl: string;
  billingCurrency: string;
  billingLocale: string;
  billingTimezone: string;
}

export interface PluginSettingsApi {
  getPublic(): Promise<PluginPublicSettingsView>;
}
