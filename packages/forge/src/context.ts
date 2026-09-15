import type { PluginConfig } from "./config.js";
import type { PluginEvents } from "./events.js";
import type { PluginHttp } from "./http.js";
import type { PluginId } from "./identity.js";
import type { PluginJobs } from "./jobs.js";
import type { PluginLogger } from "./logger.js";
import type { PluginSettingsApi } from "./settings.js";
import type { PluginStorage } from "./storage.js";
import type { PluginUsersApi } from "./users.js";

export interface PluginContext {
  readonly pluginId: PluginId;
  readonly instanceId?: string;
  readonly logger: PluginLogger;
  readonly config: PluginConfig;
  readonly storage: PluginStorage;
  readonly events: PluginEvents;
  readonly jobs: PluginJobs;
  readonly http: PluginHttp;
  readonly users: PluginUsersApi;
  readonly settings: PluginSettingsApi;
}
