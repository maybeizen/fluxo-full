import { readOptionalString } from "@/features/auth/validation";

export const settingsTabs = ["profile", "security", "sessions"] as const;

export type SettingsTab = (typeof settingsTabs)[number];

export interface SettingsSearch {
  tab?: SettingsTab;
  token?: string;
}

export function parseSettingsSearch(search: Record<string, unknown>): SettingsSearch {
  const tab = settingsTabs.find((value) => value === search.tab);
  return {
    tab,
    token: readOptionalString(search.token),
  };
}
