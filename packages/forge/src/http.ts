import type { JsonValue } from "./json.js";

export const FORGE_HTTP_DEFAULT_TIMEOUT_MS = 10_000;
export const FORGE_HTTP_MAX_TIMEOUT_MS = 60_000;

export type PluginHttpMethod =
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface PluginHttpRequest {
  url: string;
  method?: PluginHttpMethod;
  headers?: Readonly<Record<string, string>>;
  body?: JsonValue | Uint8Array;
  timeoutMs?: number;
}

export interface PluginHttpResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: JsonValue | Uint8Array;
}

export interface PluginHttp {
  request(request: PluginHttpRequest): Promise<PluginHttpResponse>;
}
