# Gateway registry

Host façade over **gateway plugin instances**. There is no invoice ledger and no Stripe (or other PSP) client in Fluxo. Plugins implement checkout, status, and optional refund using Forge DTOs.

## Factory

```ts
import { createGatewayRegistry } from "./forge/gateway-registry.js";

const gateways = createGatewayRegistry({
  persist,
  getGatewayPlugin: (pluginId) => {
    const plugin = manager.getActive(pluginId);
    return plugin && "createCheckout" in plugin ? plugin : undefined;
  },
  isPluginActive: (pluginId) => manager.getActive(pluginId) !== undefined,
  createContext: (pluginId, instanceId) =>
    createPluginContext(pluginId, instanceId),
});
```

Do **not** import `getForgeHost`. Inject persist, plugin lookup, and activity. `createContext` is optional and matches Group C's host factory `(pluginId, instanceId?)`. Operations that call the plugin require it.

`isPluginActive` must be true only for plugins that are enabled **and started**. Disabled or failed plugins stay out of the live registry.

## Instance model

One gateway **definition** (plugin id) can have many **instances** (UUID rows in `plugin_instances`, `kind: "gateway"`). Resolve by instance id, never by plugin id alone.

| Method                                            | Behavior                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `listInstances(pluginId?)`                        | Gateway rows only; includes disabled instances                              |
| `getInstance(instanceId)`                         | `null` when missing or not a gateway                                        |
| `resolve(instanceId)`                             | Throws typed errors (below)                                                 |
| `createCheckout(request)`                         | `FluxoGatewayPlugin.createCheckout`                                         |
| `getPaymentStatus(request)`                       | `FluxoGatewayPlugin.getPaymentStatus`                                       |
| `refund(request)`                                 | Optional plugin method                                                      |
| `health(instanceId)`                              | On-demand; `FORGE_HEALTH_TIMEOUT_MS` (overridable); no secrets in `message` |
| `handleWebhook(pluginId, request)`                | Optional plugin method; pass raw body for HMAC                              |
| `registerWebhookHandlers` / `listWebhookHandlers` | Allowlist of handler names                                                  |

Checkout/refund/status types come from `@fluxo/forge`. Modes are `redirect` \| `token` \| `offline`. There is **no** card PAN/CVC API.

Plugin authors implement `createCheckout`, `getPaymentStatus`, optional `refund`, and optional `handleWebhook` on `FluxoGatewayPlugin`. Declare webhook allowlist names with an extra `webhookHandlers(): readonly string[]` method on the plugin object (host duck-types it; it is not on the `FluxoGatewayPlugin` class). `forgeWebhookPath` requires a UUID `instanceId`.

## Typed errors

| Class                          | When                                        |
| ------------------------------ | ------------------------------------------- |
| `GatewayNotFoundError`         | Missing instance or missing plugin install  |
| `GatewayPluginDisabledError`   | Plugin disabled, not started, or not loaded |
| `GatewayInstanceDisabledError` | Instance `enabled === false`                |
| `GatewayWrongTypeError`        | Instance/plugin is not `gateway`            |

Plugin throws that are not `ForgeError` become `ForgeError` (`code: forge_gateway`, status 500) with a generic message. Secrets in the original throw are not copied.

## Permissions

Host-side, from the install manifest:

- `billing.checkout` — create checkout and get status
- `billing.refund` — refund
- `webhooks.receive` or `billing.webhook` — `handleWebhook`

Missing permission → `ForgePermissionError`.

## Health

`health(instanceId)` aborts after the timeout even if the plugin ignores `AbortSignal`. Failed or secret-looking messages are omitted or replaced with `Health check failed` / `Health check timed out`.
