import {
  FORGE_API_VERSION,
  FORGE_HTTP_DEFAULT_TIMEOUT_MS,
  FORGE_HTTP_MAX_TIMEOUT_MS,
  ForgeHttpError,
  ForgePermissionError,
  ForgeTimeoutError,
  ForgeValidationError,
  redactHeaders,
  type JsonValue,
  type PluginHttp,
  type PluginHttpMethod,
  type PluginHttpResponse,
  type PluginLogger,
  type PluginPermission,
} from "@fluxo/forge";

export const FORGE_HTTP_MAX_BODY_BYTES = 1_048_576;

const ALLOWED_METHODS = new Set<string>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
]);

export interface CreatePluginHttpOptions {
  pluginId: string;
  permissions: readonly PluginPermission[];
  allowlist: readonly string[];
  logger: PluginLogger;
  fetchImpl?: typeof fetch;
}

export function createPluginHttp(options: CreatePluginHttpOptions): PluginHttp {
  const permissions = new Set(options.permissions);
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async request(request) {
      if (!permissions.has("http.outbound")) {
        throw new ForgePermissionError("http.outbound");
      }
      if (options.allowlist.length === 0) {
        throw new ForgeHttpError(
          "Outbound HTTP is disabled: PLUGIN_HTTP_ALLOWLIST is empty",
        );
      }

      const url = parseRequestUrl(request.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new ForgeHttpError("Outbound HTTP URL must use http or https");
      }
      if (!isHttpHostAllowed(url, options.allowlist)) {
        throw new ForgeHttpError("Outbound HTTP host is not allowlisted");
      }

      const method = parseMethod(request.method);
      const timeoutMs = parseTimeout(request.timeoutMs);
      const headers = buildHeaders(request.headers, options.pluginId);
      const body = encodeBody(request.body, method, headers);

      const loggedHeaders = redactHeaders(headers);
      options.logger.info("plugin http request", {
        pluginId: options.pluginId,
        method,
        host: url.hostname,
        path: url.pathname,
        headers: loggedHeaders,
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method,
          headers,
          body,
          signal: controller.signal,
          redirect: "manual",
        });
        const encoded = await readResponseBody(response);
        const responseHeaders = collectHeaders(response.headers);
        options.logger.info("plugin http response", {
          pluginId: options.pluginId,
          method,
          host: url.hostname,
          status: response.status,
          headers: redactHeaders(responseHeaders),
        });
        return {
          status: response.status,
          headers: responseHeaders,
          body: encoded,
        } satisfies PluginHttpResponse;
      } catch (error) {
        if (isAbortError(error)) {
          throw new ForgeTimeoutError("Plugin HTTP request timed out");
        }
        throw new ForgeHttpError(safeHttpErrorMessage(error));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function isHttpHostAllowed(
  url: URL,
  allowlist: readonly string[],
): boolean {
  if (allowlist.length === 0) {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  const port = explicitPort(url);
  for (const raw of allowlist) {
    if (entryMatches(raw, hostname, port)) {
      return true;
    }
  }
  return false;
}

function entryMatches(raw: string, hostname: string, port: string): boolean {
  const entry = raw.trim().toLowerCase();
  if (entry.length === 0) {
    return false;
  }
  if (entry === hostname) {
    return true;
  }
  if (entry === `${hostname}:${port}`) {
    return true;
  }
  if (entry.includes("://")) {
    try {
      const allowed = new URL(entry);
      if (allowed.hostname.toLowerCase() !== hostname) {
        return false;
      }
      if (allowed.port.length === 0) {
        return true;
      }
      return allowed.port === port;
    } catch {
      return false;
    }
  }
  const colon = entry.lastIndexOf(":");
  if (colon > 0 && !entry.includes("]")) {
    const hostPart = entry.slice(0, colon);
    const portPart = entry.slice(colon + 1);
    return hostPart === hostname && portPart === port;
  }
  return false;
}

function explicitPort(url: URL): string {
  if (url.port.length > 0) {
    return url.port;
  }
  return url.protocol === "https:" ? "443" : "80";
}

function parseRequestUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ForgeValidationError("Invalid HTTP URL");
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new ForgeHttpError("Outbound HTTP URL must not include credentials");
  }
  return url;
}

function parseMethod(method: PluginHttpMethod | undefined): PluginHttpMethod {
  const resolved = (method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(resolved)) {
    throw new ForgeValidationError("Invalid HTTP method");
  }
  return resolved as PluginHttpMethod;
}

function parseTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return FORGE_HTTP_DEFAULT_TIMEOUT_MS;
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ForgeValidationError("Invalid HTTP timeout");
  }
  return Math.min(Math.floor(timeoutMs), FORGE_HTTP_MAX_TIMEOUT_MS);
}

function buildHeaders(
  headers: Readonly<Record<string, string>> | undefined,
  pluginId: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === "user-agent" || key.toLowerCase() === "host") {
        continue;
      }
      result[key] = value;
    }
  }
  result["User-Agent"] =
    `Fluxo-Forge/${FORGE_API_VERSION} (plugin; ${pluginId})`;
  return result;
}

function encodeBody(
  body: JsonValue | Uint8Array | undefined,
  method: PluginHttpMethod,
  headers: Record<string, string>,
): Uint8Array | string | undefined {
  if (body === undefined || method === "GET" || method === "HEAD") {
    return undefined;
  }
  if (body instanceof Uint8Array) {
    if (body.byteLength > FORGE_HTTP_MAX_BODY_BYTES) {
      throw new ForgeHttpError("HTTP request body exceeds size limit");
    }
    return body;
  }
  const encoded = JSON.stringify(body);
  if (Buffer.byteLength(encoded, "utf8") > FORGE_HTTP_MAX_BODY_BYTES) {
    throw new ForgeHttpError("HTTP request body exceeds size limit");
  }
  if (!hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }
  return encoded;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const match = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === match);
}

async function readResponseBody(
  response: Response,
): Promise<JsonValue | Uint8Array> {
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > FORGE_HTTP_MAX_BODY_BYTES) {
    throw new ForgeHttpError("HTTP response body exceeds size limit");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/json") ||
    contentType.includes("+json")
  ) {
    const text = new TextDecoder().decode(buffer);
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }
  if (
    contentType.startsWith("text/") ||
    contentType.includes("application/javascript")
  ) {
    return new TextDecoder().decode(buffer);
  }
  return buffer;
}

function collectHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: unknown }).name === "TimeoutError")
  );
}

function safeHttpErrorMessage(error: unknown): string {
  if (error instanceof ForgeHttpError || error instanceof ForgeTimeoutError) {
    return error.message;
  }
  if (error instanceof Error && error.message.length > 0) {
    return "Outbound HTTP request failed";
  }
  return "Outbound HTTP request failed";
}
