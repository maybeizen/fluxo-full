import type { DatabaseConfig } from "@fluxo/types";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export function createDatabase(config: DatabaseConfig) {
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

export type FluxoDatabase = ReturnType<typeof createDatabase>;
