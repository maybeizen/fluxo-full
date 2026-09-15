import { PluginSlot, usePanelHostContext } from "@/plugin-system";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { useUI } from "@/theme-system/use-ui";
import { adminSettingsTabs } from "./settings-tabs";

export function AdminSettingsPage() {
  const { AdminSettingsPage: View } = useUI();
  const model = useAdminSettings();
  const { user, settings } = usePanelHostContext();
  return (
    <View
      model={model}
      tabs={adminSettingsTabs}
      extraSections={
        user ? <PluginSlot point="admin.settings.section" slotProps={{ user, settings }} /> : null
      }
    />
  );
}
