import {
  PluginSlot,
  toPluginPublicSettings,
  toPluginUserView,
} from "@/plugin-system";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useSession } from "@/hooks/use-session";
import { useUI } from "@/theme-system";
import { ProfileSection } from "./profile/profile-section";
import type { SettingsTab } from "./search";
import { SecuritySection } from "./security/security-section";
import { SessionsSection } from "./sessions/sessions-section";

export function SettingsPage({
  tab,
  token,
}: {
  tab?: SettingsTab;
  token?: string;
}) {
  const { SettingsLayout, Skeleton } = useUI();
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

  return (
    <SettingsLayout
      tab={tab}
      profile={<ProfileSection user={user} />}
      security={<SecuritySection user={user} token={token} />}
      sessions={<SessionsSection />}
      extraSections={
        <PluginSlot
          point="client.settings.section"
          slotProps={{
            user: toPluginUserView(user),
            settings: toPluginPublicSettings(settings),
          }}
        />
      }
    />
  );
}
