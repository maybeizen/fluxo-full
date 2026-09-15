# Plugin webhooks

Fluxo mounts **one** namespaced Hono route for all gateway plugins. Plugins do not register Express, Fastify, or extra Hono routers. They declare handler names (allowlist) and implement `handleWebhook` on `FluxoGatewayPlugin`. The plugin verifies provider signatures itself using its own config secrets.

## Mount (Group C)

`apps/api/src/app.ts` is owned by Group C. Add this one-liner after creating the host:

```ts
app.route(FORGE_WEBHOOK_PATH_PREFIX, forgeWebhookRoutes(deps));
```

`FORGE_WEBHOOK_PATH_PREFIX` is `/forge/webhooks` from `@fluxo/forge`. Full paths are built with `forgeWebhookPath(pluginId, instanceId, name)`:

```
/forge/webhooks/{pluginId}/{instanceId}/{handler}
```

Example `deps`:

```ts
import { FORGE_WEBHOOK_PATH_PREFIX } from "@fluxo/forge";
import { forgeWebhookRoutes } from "./routes/forge-webhooks.js";

app.route(
  FORGE_WEBHOOK_PATH_PREFIX,
  forgeWebhookRoutes({
    persist,
    getGatewayPlugin: (pluginId) => gatewaysPluginLookup(pluginId),
    isPluginActive: (pluginId) => manager.getActive(pluginId) !== undefined,
    createContext: (pluginId, instanceId) =>
      createPluginContext(pluginId, instanceId),
    logger,
    listWebhookHandlers: (pluginId) => gateways.listWebhookHandlers(pluginId),
  }),
);
```

Export: `forgeWebhookRoutes` from `apps/api/src/routes/forge-webhooks.ts`.

Allowed methods: `GET`, `POST`, `PUT`. Handler names must match `isSafeWebhookName` (`^[a-z][a-z0-9_-]{0,63}$`) and the plugin allowlist (`webhookHandlers()` on the plugin object and/or `registerWebhookHandlers` on the gateway registry). Unknown names 404; they are not executed as paths.

## Controls

| Control                          | Behavior                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Plugin id                        | `parsePluginId` — traversal, `__proto__`, paths, uppercase rejected (400)                                |
| Missing / disabled / not started | 404 `forge_not_found`                                                                                    |
| Body size                        | `FORGE_WEBHOOK_MAX_BODY_BYTES` (256 KiB) via Hono `bodyLimit` (413)                                      |
| Parsing                          | Raw `Uint8Array` only. Host does not `eval`, `new Function`, or `JSON.parse` the body                    |
| Request id                       | Hono `requestId` middleware; `X-Request-Id` on the response; copied into plugin headers                  |
| Logging                          | Method, path ids, handler, status, byte length, request id. **No raw body, no auth headers, no secrets** |
| Errors                           | Plugin throw → 500 `{ error, code }` Forge body, no stack                                                |
| Rate limit                       | In-process sliding window per IP+path (`FORGE_WEBHOOK_RATE_LIMIT_MAX` / minute)                          |
| Signatures                       | Plugin-side using instance secrets from `ctx.config.getSecret`                                           |

Idempotency: the host passes request identity (`x-request-id`) to the plugin. It does not keep a payment ledger.

## Plugin contract

```ts
handleWebhook?(ctx: PluginContext, request: PluginWebhookRequest): Promise<PluginWebhookResult>
```

`PluginWebhookRequest.rawBody` is the exact bytes for HMAC. `instanceId` is the path instance. Provider verification stays in the plugin.
