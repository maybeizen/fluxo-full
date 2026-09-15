import {
  ForgePermissionError,
  type PluginPermission,
  type PluginPublicSettingsView,
  type PluginSettingsApi,
} from "@fluxo/forge";
import type { SettingsRuntime } from "../settings/runtime.js";

export function createPluginSettingsApi(options: {
  permissions: readonly PluginPermission[];
  settings?: Pick<SettingsRuntime, "current">;
}): PluginSettingsApi {
  const permissions = new Set(options.permissions);
  return {
    async getPublic() {
      if (!permissions.has("settings.read")) {
        throw new ForgePermissionError("settings.read");
      }
      const current = options.settings?.current();
      const view: PluginPublicSettingsView = {
        appName: current?.appName ?? "Fluxo",
        appBaseUrl: current?.appBaseUrl ?? "http://localhost:5173",
        billingCurrency: current?.billingCurrency ?? "USD",
        billingLocale: current?.billingLocale ?? "en-US",
        billingTimezone: current?.billingTimezone ?? "UTC",
      };
      return view;
    },
  };
}
