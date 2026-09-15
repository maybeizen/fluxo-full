import type { PluginPublicSettingsView, PluginUserView } from "@fluxo/forge";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useSession } from "@/hooks/use-session";

export function toPluginUserView(user: {
  id: string;
  username: string;
  email: string;
  role: PluginUserView["role"];
  suspended: boolean;
}): PluginUserView {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    suspended: user.suspended,
  };
}

export function toPluginPublicSettings(settings: {
  appName: string;
  appBaseUrl: string;
  billingCurrency: string;
  billingLocale: string;
  billingTimezone: string;
}): PluginPublicSettingsView {
  return {
    appName: settings.appName,
    appBaseUrl: settings.appBaseUrl,
    billingCurrency: settings.billingCurrency,
    billingLocale: settings.billingLocale,
    billingTimezone: settings.billingTimezone,
  };
}

export function usePanelHostContext(): {
  user: PluginUserView | null;
  settings: PluginPublicSettingsView;
} {
  const session = useSession();
  const settings = usePublicSettings();
  const user =
    session.data?.status === "authenticated"
      ? toPluginUserView(session.data.user)
      : null;
  return {
    user,
    settings: toPluginPublicSettings(settings),
  };
}
