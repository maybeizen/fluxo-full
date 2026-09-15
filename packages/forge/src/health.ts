import type { HealthStatus } from "@fluxo/types";

export const FORGE_HEALTH_TIMEOUT_MS = 5000;

export interface PluginHealthResult {
  status: HealthStatus;
  message?: string;
}

export type { HealthStatus };
