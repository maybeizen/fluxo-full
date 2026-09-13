import { fluxoMeta, type FluxoDatabase } from "@fluxo/db";
import { eq } from "drizzle-orm";

export const APP_SETTINGS_KEY = "app.settings";

export interface SettingsStore {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
}

export function createMemorySettingsStore(initial?: string | null): SettingsStore {
  let value = initial ?? null;
  return {
    async load() {
      return value;
    },
    async save(next) {
      value = next;
    },
  };
}

export function createPostgresSettingsStore(db: FluxoDatabase["db"]): SettingsStore {
  return {
    async load() {
      const rows = await db
        .select()
        .from(fluxoMeta)
        .where(eq(fluxoMeta.key, APP_SETTINGS_KEY))
        .limit(1);
      return rows[0]?.value ?? null;
    },
    async save(value) {
      const updatedAt = new Date();
      await db
        .insert(fluxoMeta)
        .values({ key: APP_SETTINGS_KEY, value, updatedAt })
        .onConflictDoUpdate({
          target: fluxoMeta.key,
          set: { value, updatedAt },
        });
    },
  };
}
