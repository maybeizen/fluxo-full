import type { Redis } from "@fluxo/redis";
import type { HealthStatus, ServiceCheck } from "@fluxo/types";
import { Hono } from "hono";

export interface HealthRouteOptions {
  redis: Pick<Redis, "ping">;
  postgres: { ping: () => Promise<void> };
  service?: string;
}

async function checkRedis(redis: Pick<Redis, "ping">): Promise<ServiceCheck> {
  const started = performance.now();
  try {
    const result = await redis.ping();
    const latencyMs = Math.round(performance.now() - started);
    if (result.toUpperCase() !== "PONG") {
      return {
        name: "redis",
        status: "unhealthy",
        latencyMs,
        message: "unexpected ping response",
      };
    }
    return { name: "redis", status: "ok", latencyMs };
  } catch {
    return {
      name: "redis",
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - started),
      message: "unreachable",
    };
  }
}

async function checkPostgres(postgres: { ping: () => Promise<void> }): Promise<ServiceCheck> {
  const started = performance.now();
  try {
    await postgres.ping();
    return {
      name: "postgres",
      status: "ok",
      latencyMs: Math.round(performance.now() - started),
    };
  } catch {
    return {
      name: "postgres",
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - started),
      message: "unreachable",
    };
  }
}

export function healthRoutes(options: HealthRouteOptions) {
  const routes = new Hono();

  routes.get("/health", async (c) => {
    const [redis, postgres] = await Promise.all([
      checkRedis(options.redis),
      checkPostgres(options.postgres),
    ]);
    const status: HealthStatus =
      redis.status === "ok" && postgres.status === "ok" ? "ok" : "unhealthy";
    return c.json({
      status,
      service: options.service ?? "api",
      checks: { redis, postgres },
      timestamp: new Date().toISOString(),
    });
  });

  return routes;
}
