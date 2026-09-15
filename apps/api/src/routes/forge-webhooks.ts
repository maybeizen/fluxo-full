import {
  FORGE_WEBHOOK_PATH_PREFIX,
  ForgeError,
  ForgeNotFoundError,
  ForgePermissionError,
  ForgeValidationError,
  forgeErrorBody,
  isForbiddenObjectKey,
  parseInstanceId,
  parsePluginId,
  parseWebhookName,
  type FluxoGatewayPlugin,
  type PluginContext,
  type PluginWebhookMethod,
  type PluginWebhookRequest,
  type PluginWebhookResult,
} from "@fluxo/forge";
import type { FluxoLogger } from "@fluxo/logger";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { listDeclaredWebhookHandlers } from "../forge/gateway-registry.js";
import type { PluginPersist } from "../forge/persist.js";

export const FORGE_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;
export const FORGE_WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
export const FORGE_WEBHOOK_RATE_LIMIT_MAX = 120;
export { FORGE_WEBHOOK_PATH_PREFIX };

const WEBHOOK_METHODS = new Set<string>(["GET", "POST", "PUT"]);
const NOT_FOUND = new ForgeNotFoundError("webhook");
const TOO_LARGE = new ForgeError(
  "forge_payload_too_large",
  "Webhook payload too large",
  413,
);
const RATE_LIMITED = new ForgeError(
  "forge_rate_limited",
  "Too many webhook requests",
  429,
);
const WEBHOOK_FAILED = new ForgeError(
  "forge_webhook",
  "Webhook handling failed",
  500,
);

export interface ForgeWebhookRouteDeps {
  persist: PluginPersist;
  getGatewayPlugin(pluginId: string): FluxoGatewayPlugin | undefined;
  isPluginActive(pluginId: string): boolean;
  createContext(
    pluginId: string,
    instanceId?: string,
  ): PluginContext | Promise<PluginContext>;
  logger: FluxoLogger;
  listWebhookHandlers?(
    pluginId: string,
  ): readonly string[] | Promise<readonly string[]>;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

export function forgeWebhookRoutes(deps: ForgeWebhookRouteDeps): Hono {
  const routes = new Hono();
  const limiter = createInProcessRateLimiter(
    deps.rateLimitWindowMs ?? FORGE_WEBHOOK_RATE_LIMIT_WINDOW_MS,
    deps.rateLimitMax ?? FORGE_WEBHOOK_RATE_LIMIT_MAX,
  );

  routes.onError((error, c) => {
    const requestIdValue = c.get("requestId");
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    if (error instanceof ForgeError) {
      return jsonForgeError(c, error, requestIdValue);
    }
    deps.logger.error("forge webhook failed", {
      requestId: requestIdValue,
      method: c.req.method,
      path: c.req.path,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return jsonForgeError(c, WEBHOOK_FAILED, requestIdValue);
  });

  routes.use("*", requestId());
  routes.use(
    "*",
    bodyLimit({
      maxSize: FORGE_WEBHOOK_MAX_BODY_BYTES,
      onError: (c) => jsonForgeError(c, TOO_LARGE, c.get("requestId")),
    }),
  );

  routes.on(
    ["GET", "POST", "PUT"],
    "/:pluginId/:instanceId/:handler",
    async (c) => {
      const requestIdValue = c.get("requestId");
      const ip = connectionIp(c);
      if (!limiter.allow(`${ip}:${c.req.path}`)) {
        return jsonForgeError(c, RATE_LIMITED, requestIdValue);
      }

      let pluginId: string;
      let instanceId: string;
      let handler: string;
      try {
        pluginId = parsePluginId(c.req.param("pluginId"));
        instanceId = parseInstanceId(c.req.param("instanceId"));
        handler = parseWebhookName(c.req.param("handler"));
      } catch (error) {
        if (error instanceof ForgeValidationError) {
          return jsonForgeError(c, error, requestIdValue);
        }
        throw error;
      }

      const method = c.req.method.toUpperCase();
      if (!WEBHOOK_METHODS.has(method)) {
        return jsonForgeError(c, NOT_FOUND, requestIdValue);
      }

      const install = await deps.persist.getInstall(pluginId);
      const plugin = deps.getGatewayPlugin(pluginId);
      const handleWebhook = plugin?.handleWebhook;
      if (
        install === undefined ||
        install.type !== "gateway" ||
        !install.enabled ||
        !deps.isPluginActive(pluginId) ||
        plugin === undefined ||
        handleWebhook === undefined
      ) {
        logWebhook(deps.logger, {
          requestId: requestIdValue,
          method,
          pluginId,
          instanceId,
          handler,
          status: 404,
        });
        return jsonForgeError(c, NOT_FOUND, requestIdValue);
      }

      if (!allowsWebhooks(install.manifest)) {
        return jsonForgeError(
          c,
          new ForgePermissionError("webhooks.receive"),
          requestIdValue,
        );
      }

      const allowed = await resolveHandlerNames(deps, pluginId, plugin);
      if (!allowed.includes(handler)) {
        logWebhook(deps.logger, {
          requestId: requestIdValue,
          method,
          pluginId,
          instanceId,
          handler,
          status: 404,
        });
        return jsonForgeError(c, NOT_FOUND, requestIdValue);
      }

      const instance = await deps.persist.getInstance(instanceId);
      if (
        instance === undefined ||
        instance.pluginId !== pluginId ||
        instance.kind !== "gateway" ||
        !instance.enabled
      ) {
        logWebhook(deps.logger, {
          requestId: requestIdValue,
          method,
          pluginId,
          instanceId,
          handler,
          status: 404,
        });
        return jsonForgeError(c, NOT_FOUND, requestIdValue);
      }

      const rawBody = new Uint8Array(await c.req.arrayBuffer());
      const webhookRequest = toWebhookRequest(
        method,
        c.req.raw.headers,
        c.req.url,
        rawBody,
        instanceId,
        requestIdValue,
      );

      const ctx = await deps.createContext(pluginId, instanceId);
      let result: PluginWebhookResult;
      try {
        result = await handleWebhook.call(plugin, ctx, webhookRequest);
      } catch (error) {
        if (error instanceof ForgeError) {
          logWebhook(deps.logger, {
            requestId: requestIdValue,
            method,
            pluginId,
            instanceId,
            handler,
            status: error.status,
            errorName: error.name,
          });
          return jsonForgeError(c, error, requestIdValue);
        }
        ctx.logger.error("gateway webhook plugin threw", {
          pluginId,
          instanceId,
          handler,
          requestId: requestIdValue,
          errorName: error instanceof Error ? error.name : "unknown",
        });
        logWebhook(deps.logger, {
          requestId: requestIdValue,
          method,
          pluginId,
          instanceId,
          handler,
          status: 500,
          errorName: error instanceof Error ? error.name : "unknown",
        });
        return jsonForgeError(c, WEBHOOK_FAILED, requestIdValue);
      }

      const status = asResponseStatus(result.status);
      if (status === undefined) {
        logWebhook(deps.logger, {
          requestId: requestIdValue,
          method,
          pluginId,
          instanceId,
          handler,
          status: 500,
          recognized: result.recognized,
          bytes: rawBody.byteLength,
        });
        return jsonForgeError(c, WEBHOOK_FAILED, requestIdValue);
      }
      logWebhook(deps.logger, {
        requestId: requestIdValue,
        method,
        pluginId,
        instanceId,
        handler,
        status,
        recognized: result.recognized,
        bytes: rawBody.byteLength,
      });
      return webhookResponse(status, result.body, requestIdValue);
    },
  );

  return routes;
}

async function resolveHandlerNames(
  deps: ForgeWebhookRouteDeps,
  pluginId: string,
  plugin: FluxoGatewayPlugin,
): Promise<readonly string[]> {
  if (deps.listWebhookHandlers !== undefined) {
    return deps.listWebhookHandlers(pluginId);
  }
  return listDeclaredWebhookHandlers(plugin);
}

function toWebhookRequest(
  method: string,
  headers: Headers,
  url: string,
  rawBody: Uint8Array,
  instanceId: string,
  requestIdValue: string,
): PluginWebhookRequest {
  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!isForbiddenObjectKey(key)) {
      headerRecord[key] = value;
    }
  });
  headerRecord["x-request-id"] = requestIdValue;
  return {
    method: method as PluginWebhookMethod,
    headers: headerRecord,
    query: readQuery(url),
    rawBody,
    instanceId,
  };
}

function readQuery(url: string): Readonly<Record<string, string>> {
  const query: Record<string, string> = {};
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return query;
  }
  for (const [key, value] of parsed.searchParams.entries()) {
    if (isForbiddenObjectKey(key) || Object.hasOwn(query, key)) {
      continue;
    }
    query[key] = value;
  }
  return query;
}

function webhookResponse(
  status: ContentfulStatusCode,
  body: unknown,
  requestIdValue: string,
): Response {
  const headers = new Headers();
  headers.set("X-Request-Id", requestIdValue);
  if (typeof body === "function") {
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(forgeErrorBody(WEBHOOK_FAILED)), {
      status: 500,
      headers,
    });
  }
  if (body === undefined) {
    return new Response(null, { status, headers });
  }
  if (typeof body === "string") {
    return new Response(body, { status, headers });
  }
  if (body instanceof Uint8Array) {
    return new Response(body, { status, headers });
  }
  headers.set("Content-Type", "application/json");
  try {
    return new Response(JSON.stringify(body), { status, headers });
  } catch {
    return new Response(JSON.stringify(forgeErrorBody(WEBHOOK_FAILED)), {
      status: 500,
      headers,
    });
  }
}

function jsonForgeError(
  c: { json: (body: unknown, status: ContentfulStatusCode) => Response },
  error: ForgeError,
  requestIdValue: string | undefined,
): Response {
  const response = c.json(
    forgeErrorBody(error),
    error.status as ContentfulStatusCode,
  );
  if (requestIdValue) {
    response.headers.set("X-Request-Id", requestIdValue);
  }
  return response;
}

function asResponseStatus(status: number): ContentfulStatusCode | undefined {
  if (
    Number.isInteger(status) &&
    status >= 200 &&
    status <= 599 &&
    status !== 204 &&
    status !== 205 &&
    status !== 304
  ) {
    return status as ContentfulStatusCode;
  }
  return undefined;
}

function allowsWebhooks(manifest: unknown): boolean {
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    return false;
  }
  const permissions = (manifest as { permissions?: unknown }).permissions;
  return (
    Array.isArray(permissions) &&
    (permissions.includes("webhooks.receive") ||
      permissions.includes("billing.webhook"))
  );
}

function connectionIp(c: { env?: unknown }): string {
  if (typeof c.env !== "object" || c.env === null || !("incoming" in c.env)) {
    return "unknown";
  }
  const incoming = (
    c.env as {
      incoming?: { socket?: { remoteAddress?: string } };
    }
  ).incoming;
  const address = incoming?.socket?.remoteAddress;
  if (typeof address === "string" && address.trim().length > 0) {
    return address.trim();
  }
  return "unknown";
}

function logWebhook(
  logger: FluxoLogger,
  meta: {
    requestId: string;
    method: string;
    pluginId: string;
    instanceId: string;
    handler: string;
    status: number;
    recognized?: boolean;
    bytes?: number;
    errorName?: string;
  },
): void {
  logger.info("forge webhook", meta);
}

function createInProcessRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string): boolean {
      const now = Date.now();
      const cutoff = now - windowMs;
      const previous = hits.get(key) ?? [];
      const next = previous.filter((stamp) => stamp > cutoff);
      if (next.length >= max) {
        hits.set(key, next);
        return false;
      }
      next.push(now);
      hits.set(key, next);
      if (hits.size > 10_000) {
        for (const [slot, stamps] of hits) {
          const kept = stamps.filter((stamp) => stamp > cutoff);
          if (kept.length === 0) {
            hits.delete(slot);
          } else {
            hits.set(slot, kept);
          }
        }
      }
      return true;
    },
  };
}
