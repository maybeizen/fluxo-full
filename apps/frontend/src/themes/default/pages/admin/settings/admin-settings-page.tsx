import type { ComponentType, ReactNode } from "react";
import type { AdminSettingsTabId, AdminSettingsTabItem } from "@/features/admin/settings/settings-tabs";
import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsPage({
  model,
  tabs,
  extraSections,
}: {
  model: AdminSettingsModel;
  tabs: readonly AdminSettingsTabItem[];
  extraSections?: ReactNode;
}) {
  const t = useT();
  const {
    AdminSettingsApplicationTab,
    AdminSettingsAuthenticationTab,
    AdminSettingsBillingTab,
    AdminSettingsSecurityTab,
    AdminSettingsSmtpTab,
    AdminSettingsStorageTab,
    AdminSettingsThemeTab,
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Skeleton,
    Spinner,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } = useUI();

  const panels = {
    application: AdminSettingsApplicationTab,
    theme: AdminSettingsThemeTab,
    authentication: AdminSettingsAuthenticationTab,
    smtp: AdminSettingsSmtpTab,
    storage: AdminSettingsStorageTab,
    security: AdminSettingsSecurityTab,
    billing: AdminSettingsBillingTab,
  } satisfies Record<AdminSettingsTabId, ComponentType<{ model: AdminSettingsModel }>>;

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-6" onSubmit={model.onSubmit}>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {t("admin.settings.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("admin.settings.description")}</p>
        </div>
        {model.formError ? (
          <Alert variant="destructive">
            <AlertTitle>{t("admin.settings.saveFailed")}</AlertTitle>
            <AlertDescription>{model.formError}</AlertDescription>
          </Alert>
        ) : null}
        {model.query.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : null}
        {model.query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t("admin.settings.loadTitle")}</AlertTitle>
            <AlertDescription>{t("admin.settings.loadBody")}</AlertDescription>
          </Alert>
        ) : null}
        {model.settings ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.settings.panelTitle")}</CardTitle>
              <CardDescription>{t("admin.settings.panelDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={tabs[0]?.id ?? "application"}>
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
                    <TabsContent key={tab.id} value={tab.id} className="pt-6">
                      <Panel model={model} />
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={model.saving}>
                {model.saving ? <Spinner data-icon="inline-start" /> : null}
                {model.saving ? t("admin.settings.saving") : t("admin.settings.save")}
              </Button>
            </CardFooter>
          </Card>
        ) : null}
      </form>
      {extraSections}
    </div>
  );
}
