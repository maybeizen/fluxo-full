import type { PluginId } from "./identity.js";
import type { JsonValue } from "./json.js";

export interface PluginJobSchedule {
  name: string;
  payload?: JsonValue;
  runAt?: string;
  delayMs?: number;
  cron?: string;
}

export interface PluginJobHandle {
  jobId: string;
}

export interface PluginJobs {
  schedule(job: PluginJobSchedule): Promise<PluginJobHandle>;
  cancel(jobId: string): Promise<void>;
}

export function qualifyJobName(pluginId: PluginId, name: string): string {
  return `${pluginId}:${name}`;
}
