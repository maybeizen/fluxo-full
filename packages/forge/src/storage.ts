import type { JsonValue } from "./json.js";

export interface PluginStorage {
  get(key: string): Promise<JsonValue | undefined>;
  set(key: string, value: JsonValue): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<readonly string[]>;
}
