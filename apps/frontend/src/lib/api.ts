import { z } from "zod";

const healthStatusSchema = z.enum(["ok", "degraded", "unhealthy"]);

const healthCheckSchema = z.object({
  status: healthStatusSchema,
  latencyMs: z.number().optional(),
  message: z.string().optional(),
});

const healthResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.string(),
  checks: z.record(z.string(), z.union([healthStatusSchema, healthCheckSchema])),
  timestamp: z.string(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export function getApiUrl(): string | undefined {
  const url = import.meta.env.VITE_PUBLIC_API_URL;
  if (typeof url !== "string" || url.length === 0) {
    return undefined;
  }
  return url.replace(/\/$/, "");
}

export async function fetchHealth(apiUrl: string): Promise<HealthResponse> {
  const response = await fetch(`${apiUrl}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return healthResponseSchema.parse(await response.json());
}
