import {
  PluginSlot,
  toPluginPublicSettings,
  toPluginUserView,
} from "@/plugin-system";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useSession } from "@/hooks/use-session";
import { useUI } from "@/theme-system/use-ui";
import {
  dashboardCtaTo,
  dashboardProfileTo,
  dashboardSupportTo,
  dashboardTabs,
  getDashboardProfileLinks,
} from "./dashboard-data";
import { formatJoined } from "./format";

export function DashboardPage() {
  const { DashboardPage: View, Skeleton } = useUI();
  const session = useSession();
  const settings = usePublicSettings();
  const user =
    session.data?.status === "authenticated" ? session.data.user : undefined;

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const slotProps = {
    user: toPluginUserView(user),
    settings: toPluginPublicSettings(settings),
  };

  return (
    <View
      user={user}
      joinedLabel={formatJoined(user.createdAt)}
      links={getDashboardProfileLinks(settings.appSupportTicketsEnabled)}
      tabs={dashboardTabs}
      profileTo={dashboardProfileTo}
      ctaTo={dashboardCtaTo}
      supportTo={
        settings.appSupportTicketsEnabled ? dashboardSupportTo : undefined
      }
      extensions={{
        services: (
          <PluginSlot point="client.dashboard.services" slotProps={slotProps} />
        ),
        invoices: (
          <PluginSlot point="client.dashboard.invoices" slotProps={slotProps} />
        ),
        news: (
          <PluginSlot point="client.dashboard.news" slotProps={slotProps} />
        ),
        support: (
          <PluginSlot point="client.dashboard.support" slotProps={slotProps} />
        ),
      }}
    />
  );
}
