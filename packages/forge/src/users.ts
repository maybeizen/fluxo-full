import type { UserRole } from "@fluxo/types";

export interface PluginUserView {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  suspended: boolean;
}

export interface PluginUsersApi {
  getById(id: string): Promise<PluginUserView | null>;
}
