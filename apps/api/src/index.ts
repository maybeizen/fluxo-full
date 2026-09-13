import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { serve } from "@hono/node-server";
import { createLogger } from "@fluxo/logger";
import { assertRedis, createRedis } from "@fluxo/redis";
import { createApp } from "./app.js";
import { loadEnv, type Env } from "./env.js";

const rootEnvPath = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const logger = createLogger({
  service: "api",
  directory: path.join(process.cwd(), "logs"),
});

async function start(): Promise<void> {
  let env: Env;
  try {
    env = loadEnv();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : "Invalid environment");
    process.exit(1);
  }

  const redis = createRedis({ url: env.REDIS_URL });
  try {
    await assertRedis(redis);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : "Redis unavailable");
    process.exit(1);
  }

  const app = createApp({ logger, redis, corsOrigin: env.FRONTEND_URL });
  serve({ fetch: app.fetch, port: env.PORT });
  logger.info("api listening", { port: env.PORT, name: env.APP_NAME });
}

void start();
