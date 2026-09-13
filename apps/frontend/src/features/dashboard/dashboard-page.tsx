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
  const user = session.data?.status === "authenticated" ? session.data.user : undefined;

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <View
      user={user}
      joinedLabel={formatJoined(user.createdAt)}
      links={getDashboardProfileLinks(settings.appSupportTicketsEnabled)}
      tabs={dashboardTabs}
      profileTo={dashboardProfileTo}
      ctaTo={dashboardCtaTo}
      supportTo={settings.appSupportTicketsEnabled ? dashboardSupportTo : undefined}
    />
  );
}
