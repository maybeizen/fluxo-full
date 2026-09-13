import {
  CreditCardIcon,
  HardDriveIcon,
  KeyRoundIcon,
  MailIcon,
  PaletteIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminSettingsTabId =
  | "application"
  | "theme"
  | "authentication"
  | "smtp"
  | "storage"
  | "security"
  | "billing";

export interface AdminSettingsTabItem {
  id: AdminSettingsTabId;
  labelKey: string;
  icon: LucideIcon;
}

export const adminSettingsTabs: readonly AdminSettingsTabItem[] = [
  { id: "application", labelKey: "admin.settings.tab.application", icon: SlidersHorizontalIcon },
  { id: "theme", labelKey: "admin.settings.tab.theme", icon: PaletteIcon },
  { id: "authentication", labelKey: "admin.settings.tab.authentication", icon: KeyRoundIcon },
  { id: "smtp", labelKey: "admin.settings.tab.smtp", icon: MailIcon },
  { id: "storage", labelKey: "admin.settings.tab.storage", icon: HardDriveIcon },
  { id: "security", labelKey: "admin.settings.tab.security", icon: ShieldIcon },
  { id: "billing", labelKey: "admin.settings.tab.billing", icon: CreditCardIcon },
];
