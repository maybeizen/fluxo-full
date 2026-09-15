# Forge host (Group C)

Fluxo boots plugins from `apps/api/src/index.ts` via `startForge` / `stopForge`. Do not construct the plugin manager inside `app.ts`. Mount webhook routes on the Hono app after the host exists.

## Obtaining persist, manager, and context

After `startForge()`:

```ts
import { getForgeHost } from "../forge/boot.js";

const host = getForgeHost();
const persist = host.persist;
const manager = host.manager;
const services = host.services;
const gateways = host.gateways;
const ctx = await host.createContext(pluginId, instanceId);
```

`ForgeHost` is defined in `apps/api/src/forge/host.ts` and re-exported from `boot.ts`.

| Field                                  | Use                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `persist`                              | Group B `PluginPersist` (installs, instances, KV, secrets)                                                     |
| `manager`                              | Group A `PluginManager` (`loadAll`, lifecycle, `getActive`)                                                    |
| `services`                             | Group D `HostServiceRegistry` (`listInstances`, `getInstance`, `resolve`)                                      |
| `gateways`                             | Group E `FluxoGatewayRegistry` (`resolve`, checkout, refund, `handleWebhook`)                                  |
| `createContext(pluginId, instanceId?)` | Builds `PluginContext` with the trusted plugin id                                                              |
| `events`                               | Host event bus. Plugins subscribe through `ctx.events`. Host code emits with `emitForgeEvent` from `events.ts` |
| `jobs`                                 | In-process scheduler. Public `PluginJobs` is `schedule` / `cancel` only. Handler registration (`handle`) lives on the host adapter (`HostPluginJobs` in `jobs.ts`) and is **not** exported from `@fluxo/forge`. |

Do not import `apps/api/src/forge/persist.ts` constructors from registries if the running host already has persist; reuse `getForgeHost().persist`.

After `manager.loadAll()`, registries are bound to the live manager:

```ts
host.services.resolve(instanceId);
host.gateways.resolve(instanceId);
```

`getServicePlugin` duck-types `provision` + `capabilities`. `getGatewayPlugin` duck-types `createCheckout` + `getPaymentStatus`. Pass `host.createContext(pluginId, instanceId)` into registries; do not import `getForgeHost()` from registry modules.

## Install-state adapter

`PluginPersist.getInstall()` uses **row presence = installed** plus `enabled`. The manager wants `{ installed, enabled }`.

`createInstallStateAdapter` / `installStateFromRow` in `host.ts`:

- missing row → `{ installed: false, enabled: false }`
- row present → `{ installed: true, enabled: row.enabled }`

Boot does not call `onInstall` / `onEnable`. Failed plugins are logged and skipped.

## Events from existing mutations

`emitForgeEvent(name, payload)` is a no-op until `startForge` sets the active bus. User CRUD, session issue/destroy, and settings save can call it without importing the manager.

## Webhooks

`apps/api/src/app.ts` mounts Group E's router when `createApp` receives `forge`:

```ts
app.route(FORGE_WEBHOOK_PATH_PREFIX, forgeWebhookRoutes(deps));
```

`index.ts` passes the host from `startForge`. Deps use `host.persist`, `host.manager.getActive`, `host.createContext`, and `host.gateways.listWebhookHandlers`. Paths are `/forge/webhooks/{pluginId}/{instanceId}/{handler}`. Enabled+started gateway plugins with `handleWebhook` are served; missing, disabled, or inactive plugins 404.

## Admin plugins

The same `if (options.forge)` block mounts Group G at `/admin` (alongside existing `/admin/users` and `/admin/settings`):

```ts
app.route(
  "/admin",
  adminPluginRoutes({
    sessions: auth.sessions,
    users: auth.users,
    passkeys: auth.passkeys,
    persist: forge.persist,
    manager: forge.manager,
    createContext: (pluginId, instanceId) =>
      forge.createContext(pluginId, instanceId),
  }),
);
```

List is `GET /admin/plugins`. Detail, enable, disable, uninstall, config, health, and instances live under `/admin/plugins/:pluginId`. Unauthenticated 401; non-admin 403.
