# Forge host (Group C)

Fluxo boots plugins from `apps/api/src/index.ts` via `startForge` / `stopForge`. Do not construct the plugin manager inside `app.ts`. Group E mounts webhook routes; this host does not.

## Obtaining persist, manager, and context

After `startForge()`:

```ts
import { getForgeHost } from "../forge/boot.js";

const host = getForgeHost();
const persist = host.persist;
const manager = host.manager;
const ctx = await host.createContext(pluginId, instanceId);
```

`ForgeHost` is defined in `apps/api/src/forge/host.ts` and re-exported from `boot.ts`.

| Field | Use |
| --- | --- |
| `persist` | Group B `PluginPersist` (installs, instances, KV, secrets) |
| `manager` | Group A `PluginManager` (`loadAll`, lifecycle, `getActive`) |
| `createContext(pluginId, instanceId?)` | Builds `PluginContext` with the trusted plugin id |
| `events` | Host event bus. Plugins subscribe through `ctx.events`. Host code emits with `emitForgeEvent` from `events.ts` |
| `jobs` | In-process scheduler. Plugins use `ctx.jobs.schedule` / `cancel` / `handle` |

Do not import `apps/api/src/forge/persist.ts` constructors from registries if the running host already has persist; reuse `getForgeHost().persist`.

## Install-state adapter

`PluginPersist.getInstall()` uses **row presence = installed** plus `enabled`. The manager wants `{ installed, enabled }`.

`createInstallStateAdapter` / `installStateFromRow` in `host.ts`:

- missing row → `{ installed: false, enabled: false }`
- row present → `{ installed: true, enabled: row.enabled }`

Boot does not call `onInstall` / `onEnable`. Failed plugins are logged and skipped.

## Events from existing mutations

`emitForgeEvent(name, payload)` is a no-op until `startForge` sets the active bus. User CRUD, session issue/destroy, and settings save can call it without importing the manager.

## Webhooks

No HTTP mount. Group E should add `app.route("/forge/webhooks", …)` in `app.ts` and read `getForgeHost()` from there.
