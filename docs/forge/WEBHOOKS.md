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
    gateways,
    logger,
    listWebhookHandlers: (pluginId) => gateways.listWebhookHandlers(pluginId),
  }),
);
```

Export: `forgeWebhookRoutes` from `apps/api/src/routes/forge-webhooks.ts`.

Allowed methods: `GET`, `POST`, `PUT`. Handler names must match `isSafeWebhookName` (`^[a-z][a-z0-9_-]{0,63}$`) and the plugin allowlist (`webhookHandlers()` on the plugin object and/or `registerWebhookHandlers` on the gateway registry). Unknown names 404; they are not executed as paths.

## Controls

| Control                          | Behavior                                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin id                        | `parsePluginId` — traversal, `__proto__`, paths, uppercase rejected (400)                                                                       |
| Missing / disabled / not started | 404 `forge_not_found`                                                                                                                           |
| Body size                        | `FORGE_WEBHOOK_MAX_BODY_BYTES` (256 KiB) via Hono `bodyLimit` (413)                                                                             |
| Parsing                          | Raw `Uint8Array` only. Host does not `eval`, `new Function`, or `JSON.parse` the body                                                           |
| Request id                       | Hono `requestId` middleware; `X-Request-Id` on the response; copied into plugin headers                                                         |
| Logging                          | Method, path ids, handler, status, byte length, request id. **No raw body, no auth headers, no secrets**                                        |
| Errors                           | Plugin throw → 500 `{ error, code }` Forge body, no stack                                                                                       |
| Rate limit                       | In-process sliding window per connection IP+path (`FORGE_WEBHOOK_RATE_LIMIT_MAX` / minute). Client `X-Forwarded-For` / `X-Real-IP` are ignored. |
| Signatures                       | Plugin-side using instance secrets from `ctx.config.getSecret`                                                                                  |

After path, plugin, instance, allowlist, and rate-limit checks, the HTTP route calls `gateways.handleWebhook` so `payment.completed` / `payment.failed` / `payment.refunded` emit from the same registry path as in-process webhook handling.

Idempotency: the host passes request identity (`x-request-id`) to the plugin. It does not keep a payment ledger. Fluxo is **not** a PSP: webhook `payment.status` must not grant entitlements until a future journal exists.

## Plugin contract

```ts
handleWebhook?(ctx: PluginContext, request: PluginWebhookRequest): Promise<PluginWebhookResult>
```

`PluginWebhookRequest.rawBody` is the exact bytes for HMAC. `instanceId` is the path instance. Provider verification stays in the plugin.

Plugins **must**:

- Verify a signature (HMAC or equivalent) of the **raw body** with `ctx.config.getSecret`, using a constant-time compare. Do not accept a shared-secret header as a substitute.
- Persist processed event ids in `ctx.storage`, keyed by `instanceId`, so provider retries do not re-apply.
- Keep payment status monotonic: completed/refunded must not move back to pending/failed.

The example gateway (`plugins/example-gateway`) uses:

```
X-Webhook-Signature: sha256=<hex hmac-sha256 of raw body>
```

with `ctx.config.getSecret("secret")`. See [GATEWAY.md](./GATEWAY.md).
