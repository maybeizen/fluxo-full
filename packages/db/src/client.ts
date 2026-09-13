import type { DatabaseConfig } from "@fluxo/types";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DatabaseConfigError, DatabasePingError } from "./errors.js";
import * as schema from "./schema/index.js";

export function createDatabase(config: DatabaseConfig) {
  if (config.url.trim() === "") {
    throw new DatabaseConfigError();
  }

  const client = postgres(config.url);
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    async ping() {
      await client`SELECT 1`;
    },
  };
}

export async function assertDatabase(database: FluxoDatabase): Promise<void> {
  try {
    await database.ping();
  } catch (error) {
    if (error instanceof DatabasePingError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Postgres ping failed";
    throw new DatabasePingError(message);
  }
}

export type FluxoDatabase = ReturnType<typeof createDatabase>;
