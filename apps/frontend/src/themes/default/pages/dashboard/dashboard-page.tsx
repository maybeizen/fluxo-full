import type { ComponentType, ReactNode } from "react";
import type {
  DashboardProfileLink,
  DashboardTabId,
  DashboardTabItem,
} from "@/features/dashboard/dashboard-data";
import type { PublicUser } from "@/lib/auth";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DashboardPage({
  user,
  joinedLabel,
  links,
  tabs,
  profileTo,
  ctaTo,
  supportTo,
  extensions,
}: {
  user: PublicUser;
  joinedLabel: string;
  links: readonly DashboardProfileLink[];
  tabs: readonly DashboardTabItem[];
  profileTo: "/settings";
  ctaTo: "/store";
  supportTo?: "/support";
  extensions?: Partial<Record<DashboardTabId, ReactNode>>;
}) {
  const {
    Card,
    CardContent,
    DashboardCta,
    DashboardInvoicesPanel,
    DashboardLinksCard,
    DashboardNewsPanel,
    DashboardProfileCard,
    DashboardServicesPanel,
    DashboardSupportPanel,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } = useUI();
  const t = useT();

  const panels = {
    services: () => <DashboardServicesPanel storeTo={ctaTo} />,
    invoices: () => <DashboardInvoicesPanel />,
    news: () => <DashboardNewsPanel />,
    support: () => <DashboardSupportPanel supportTo={supportTo} />,
  } satisfies Record<DashboardTabId, ComponentType>;

  return (
    <div className="grid min-h-[36rem] flex-1 gap-6 lg:h-[calc(100svh-5.5rem)] lg:min-h-0 lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]">
      <div className="grid min-h-0 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <DashboardProfileCard
          user={user}
          joinedLabel={joinedLabel}
          profileTo={profileTo}
        />
        <DashboardLinksCard links={links} />
      </div>
      <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(0,2fr)] gap-6">
        <DashboardCta
          name={user.firstName.trim() || user.username}
          actionTo={ctaTo}
        />
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Tabs
              defaultValue={tabs[0]?.id ?? "services"}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList variant="line" className="flex-wrap">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id}>
                      <Icon data-icon="inline-start" />
                      {t(tab.labelKey)}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {tabs.map((tab) => {
                const Panel = panels[tab.id];
                return (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    className="min-h-0 flex-1"
                  >
                    <Panel />
                    {extensions?.[tab.id]}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
