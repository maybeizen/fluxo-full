import {
  ForgePermissionError,
  type PluginPermission,
  type PluginUserView,
  type PluginUsersApi,
} from "@fluxo/forge";
import type { UserRecord } from "../auth/stores/types.js";

export interface PluginUserLookup {
  findById(id: string): Promise<UserRecord | null>;
}

export function createPluginUsersApi(options: {
  permissions: readonly PluginPermission[];
  users?: PluginUserLookup;
}): PluginUsersApi {
  const permissions = new Set(options.permissions);
  return {
    async getById(id) {
      if (!permissions.has("users.read")) {
        throw new ForgePermissionError("users.read");
      }
      if (!options.users) {
        return null;
      }
      const user = await options.users.findById(id);
      return user === null ? null : toPluginUserView(user);
    },
  };
}

export function toPluginUserView(user: UserRecord): PluginUserView {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    suspended: user.suspendedAt !== null,
  };
}
