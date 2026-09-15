import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { serve } from "@hono/node-server";
import { assertDatabase, createDatabase } from "@fluxo/db";
import { createLogger } from "@fluxo/logger";
import { assertRedis, createRedis } from "@fluxo/redis";
import { createApp } from "./app.js";
import { createAuthServices } from "./auth/create-auth.js";
import { loadEnv, type Env } from "./env.js";
import { startForge, stopForge, type ForgeHost } from "./forge/boot.js";

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
    logger.error(
      error instanceof Error ? error.message : "Invalid environment",
    );
    process.exit(1);
  }

  if (env.SESSION_SECRET.length === 0) {
    logger.error("SESSION_SECRET is required");
    process.exit(1);
  }

  const database = createDatabase({ url: env.POSTGRES_URL });
  try {
    await assertDatabase(database);
  } catch (error) {
    logger.error(
      error instanceof Error ? error.message : "Postgres unavailable",
    );
    process.exit(1);
  }

  const redis = createRedis({ url: env.REDIS_URL });
  try {
    await assertRedis(redis);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : "Redis unavailable");
    process.exit(1);
  }

  const auth = await createAuthServices({ database, redis, env, logger });
  let forge: ForgeHost | undefined;
  try {
    forge = await startForge({
      logger,
      pluginsDir: env.PLUGINS_DIR,
      database,
      appKey: env.APP_KEY,
      httpAllowlist: env.PLUGIN_HTTP_ALLOWLIST,
      users: auth.users,
      settings: auth.settings,
    });
  } catch (error) {
    logger.error(
      error instanceof Error ? error.message : "Forge failed to start",
    );
  }

  const app = createApp({
    logger,
    redis,
    postgres: database,
    corsOrigin: env.FRONTEND_URL,
    auth,
    forge,
  });
  serve({ fetch: app.fetch, port: env.PORT });
  logger.info("api listening", { port: env.PORT, name: env.APP_NAME });

  const shutdown = (signal: string): void => {
    void (async () => {
      logger.info("api stopping", { signal });
      await stopForge();
      process.exit(0);
    })();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

void start();
