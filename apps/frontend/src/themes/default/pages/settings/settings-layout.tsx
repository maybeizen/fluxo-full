import { KeyRoundIcon, ShieldIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { SettingsTab } from "@/features/settings/search";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function SettingsLayout({
  tab,
  profile,
  security,
  sessions,
}: {
  tab?: SettingsTab;
  profile: ReactNode;
  security: ReactNode;
  sessions: ReactNode;
}) {
  const { Tabs, TabsContent, TabsList, TabsTrigger } = useUI();
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.description")}</p>
      </div>
      <Tabs defaultValue={tab ?? "profile"}>
        <TabsList variant="line">
          <TabsTrigger value="profile">
            <UserRoundIcon data-icon="inline-start" />
            {t("settings.tab.profile")}
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldIcon data-icon="inline-start" />
            {t("settings.tab.security")}
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <KeyRoundIcon data-icon="inline-start" />
            {t("settings.tab.sessions")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">{profile}</TabsContent>
        <TabsContent value="security">{security}</TabsContent>
        <TabsContent value="sessions">{sessions}</TabsContent>
      </Tabs>
    </div>
  );
}
