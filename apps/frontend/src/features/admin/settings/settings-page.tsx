import { useAdminSettings } from "@/hooks/use-admin-settings";
import { useUI } from "@/theme-system/use-ui";
import { adminSettingsTabs } from "./settings-tabs";

export function AdminSettingsPage() {
  const { AdminSettingsPage: View } = useUI();
  const model = useAdminSettings();
  return <View model={model} tabs={adminSettingsTabs} />;
}
