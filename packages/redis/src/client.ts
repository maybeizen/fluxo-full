import type { RedisConfig } from "@fluxo/types";
import { Redis } from "ioredis";
import { RedisConfigError, RedisPingError } from "./errors.js";

export type { Redis };

export function createRedis(config: RedisConfig): Redis {
  if (config.url.trim() === "") {
    throw new RedisConfigError();
  }

  return new Redis(config.url);
}

export async function assertRedis(redis: Redis): Promise<void> {
  try {
    const result = await redis.ping();
    if (result.toUpperCase() !== "PONG") {
      throw new RedisPingError();
    }
  } catch (error) {
    if (error instanceof RedisPingError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Redis ping failed";
    throw new RedisPingError(message);
  }
}
