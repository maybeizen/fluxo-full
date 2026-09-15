# Service plugin registry

Host-side registry for **service** plugin instances. Plugin code is a definition; operators create one or more provider instances of that definition. Application code resolves work by **instance id**, never by plugin id or a hardcoded provider name.

Owned by Group D: `apps/api/src/forge/service-registry.ts`. Persistence is Group B (`persist.ts`). Context adapters are Group C. This module does not import `getForgeHost()`.

## Factory

```ts
import { FluxoServicePlugin } from "@fluxo/forge";
import { createServiceRegistry } from "./service-registry.js";

const services = createServiceRegistry({
  persist,
  getServicePlugin(pluginId) {
    const plugin = manager.getActive(pluginId);
    if (
      plugin &&
      typeof (plugin as FluxoServicePlugin).provision === "function" &&
      typeof (plugin as FluxoServicePlugin).capabilities === "function"
    ) {
      return plugin as FluxoServicePlugin;
    }
    return undefined;
  },
  isPluginActive: (pluginId) => manager.getActive(pluginId) !== undefined,
  createContext: (pluginId, instanceId) => createPluginContext(pluginId, instanceId),
});
```

Construct this after the plugin manager has `loadAll()`'d. Pass explicit deps; do not import `getForgeHost()` from this module. Group C boot should wrap the host context factory:

```ts
createContext: (pluginId, instanceId) =>
  host.createContext(pluginId, { instanceId }),
```

`createContext` is required for provision, power, reconcile, and health. `healthTimeoutMs` defaults to `FORGE_HEALTH_TIMEOUT_MS` (5000).

## Resolve

`resolve(instanceId)` returns a bound provider (`instance` + `pluginId` + operations) or a typed Forge error:

| Condition | Error |
| --- | --- |
| Unknown instance | `ForgeNotFoundError` |
| Gateway (or other non-service) instance | `ForgeValidationError` |
| Instance disabled | `ForgeConflictError` |
| Plugin disabled / not started (`isPluginActive` false) | `ForgeConflictError` |
| Plugin `status: "error"` or not a `FluxoServicePlugin` | `ForgeError` `forge_plugin_failed` |

Persist already blocks disable/uninstall while enabled instances exist. The registry still fail-closes if those helpers are skipped.

`listInstances` / `getInstance` return service instances only (including disabled). They do not throw for a disabled row.

## Operations

Callers ask `provider.supports("provision.create")` using `SERVICE_CAPABILITIES` from `@fluxo/forge`. Unknown capability strings advertised by a plugin are ignored. Do not branch on plugin id.

Bound methods (`provisionService`, `suspend`, `unsuspend`, `terminate`, `getService`, `power`, `health`) always bind `instanceId` from the resolved row. Plugin throws are isolated and mapped to Forge errors. Client-facing bodies use `forgeErrorBody` (message + code only); secrets and stack frames are not copied through.

## Persistence

There is no core service/invoice table. Provision results are stored in plugin KV:

- `forge/service/{instanceId}/{serviceId}/state` — `remoteId`, `status`, `operationId`, `runtime`
- `forge/service/{instanceId}/{serviceId}/idemp/{sha256}` — same `idempotencyKey` + action replays `remoteId` with `idempotentReplay: true`

Keys are host-namespaced under the plugin id. Failed provisions are not recorded, so callers can retry.

## Health

On-demand only. No background loop. The host aborts after the timeout and throws `ForgeTimeoutError` with a generic message. Health `message` values that look like tokens/passwords/`EncryptedPayload` are replaced with `[redacted]`.
