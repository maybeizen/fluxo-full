export type HealthStatus = "ok" | "degraded" | "unhealthy";

export interface ServiceCheck {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
}
