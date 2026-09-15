# Forge plugin system — implementation plan

Phase 1 (this branch) establishes **authoritative contracts** in `@fluxo/forge` plus docs. Later groups implement against `docs/forge/CONTRACTS.md` and the package barrel. Do not invent parallel APIs.

## Invariants

```
Plugins → @fluxo/forge → host adapters in apps/api (and SPA plugin-system) → Fluxo internals
```

Plugins never import `@fluxo/db`, Drizzle schema, Prisma, Pterodactyl credentials, Zustand stores, or `apps/api/src/**` internals.

Themes stay untouched as an architecture. Panel UI uses `apps/frontend/src/plugin-system/` (new), not `theme-system/`.

Reuse secrets: `apps/api/src/settings/secrets.ts` + `APP_KEY` + `EncryptedPayload`.

## Current stub vs target

| Stub today                                              | Target                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/plugin-manager` loads `*.js` from a directory | Validate `plugin.json`, resolve `entry`, fail-safe import                                                                          |
| Lifecycle `onLoad`/`onUnload`                           | `onInstall` / `onEnable` / `onStart` / `onStop` / `onDisable` / `onUninstall` (legacy aliases may be called only during migration) |
| Shared `config` blob for all plugins                    | Per-plugin/per-instance config; secrets sealed                                                                                     |
| No registries                                           | Plugin / service / gateway / panel registries                                                                                      |
| Admin `/admin/plugins` placeholder                      | Admin inspection API + UI                                                                                                          |
| API does not boot the manager                           | `apps/api/src/index.ts` wires host after DB/Redis                                                                                  |

Keep `@fluxo/types` `PluginManifest` / `PluginStatus` until Group A migrates the stub manager. Authoritative types are `@fluxo/forge`.

## Parallel groups (file ownership)

Paths listed are **owned** by that group. Do not edit another group's files except to import public `@fluxo/forge` exports.

### Group A — Loader and lifecycle

**Owns**

- `packages/plugin-manager/src/**` (rewrite against Forge contracts)
- `packages/plugin-manager/package.json` (deps on `@fluxo/forge` already)
- `apps/api/src/forge/load-path.ts` (new; `resolveSafePath` from `@fluxo/s3`)
- `apps/api/src/env.ts` only if `PLUGINS_DIR` / allowlist parsing needs tightening

**Does**

- Parse manifests with `parsePluginManifest` from `@fluxo/forge` (delete the local slim Zod copy)
- Canonical id = directory name = `manifest.id`
- Call lifecycle in documented order; `onStart` once when an enabled plugin is initialized, not on every HTTP request
- Isolate hook failures
- Keep existing Vitest coverage and extend it for the new hooks

**Does not**

- Admin UI, Drizzle tables, Hono webhook router, theme files

### Group B — Persistence

**Owns**

- `packages/db/src/schema/plugins.ts` (new) and barrel export in `packages/db/src/schema/index.ts`
- `packages/db/drizzle/*` new migration
- `apps/api/src/forge/persist.ts` (new) — installs, instances, KV, secrets

**Planned tables** (names may be adjusted, columns must match admin DTOs)

- `plugin_installs` — plugin id, type, version, enabled, lifecycle status, error, manifest snapshot, timestamps
- `plugin_instances` — uuid id, plugin id, kind `service|gateway`, display name, enabled, non-secret config JSON
- `plugin_kv` — plugin id, key, JSON value (plugin storage)
- `plugin_secrets` — plugin id, optional instance id, key, `EncryptedPayload` JSON

**Does**

- Seal/open via `sealSecret` / `openSecret` and `APP_KEY`
- No secret values in logs or in objects returned to route handlers that serialize to the browser

**Does not**

- Loader import graph, frontend, fake invoice tables

### Group C — Host `PluginContext` adapters

**Owns**

- `apps/api/src/forge/context.ts`
- `apps/api/src/forge/http.ts` (allowlist + timeouts + header redaction)
- `apps/api/src/forge/events.ts`
- `apps/api/src/forge/jobs.ts`
- `apps/api/src/forge/logger.ts`
- `apps/api/src/forge/users-api.ts`
- `apps/api/src/forge/settings-api.ts`

**Does**

- Implement every `PluginContext` field from `@fluxo/forge`
- Emit Forge events from existing mutations (user CRUD in `apps/api/src/routes/admin.ts` and auth session issue/destroy; settings save in `apps/api/src/settings/runtime.ts`) — **minimal hook points only**, keep business logic in place
- Jobs: in-process scheduler acceptable until Redis-backed work exists; names must go through `qualifyJobName`

**Does not**

- Theme system, Drizzle schema (consume Group B), panel React

### Group D — Service registry

**Owns**

- `apps/api/src/forge/service-registry.ts`
- `apps/api/src/routes/admin-services.ts` (admin instance CRUD **only if** Group G needs it in the same slice; otherwise keep registry in-process and let G add routes)

**Does**

- `ServiceRegistry.resolve(instanceId)`
- Map provision results into storage (`remoteId`, idempotency key)
- Advertise capabilities from the plugin class, not a hardcoded Pterodactyl list

**Does not**

- Invent a full product/order module or Pterodactyl client
- Client `/services` page productization (unless a later product group exists)

### Group E — Gateway registry and webhooks

**Owns**

- `apps/api/src/forge/gateway-registry.ts`
- `apps/api/src/routes/forge-webhooks.ts`
- Wire `app.route("/forge/webhooks", …)` in `apps/api/src/app.ts` (coordinate with anyone else touching `app.ts`; keep the mount line only)

**Does**

- Namespaced Hono routes; verify plugin id + instance id with Forge parsers
- Pass raw body for signature checks
- Provider-neutral payment DTOs from `@fluxo/forge`

**Does not**

- Stripe SDK types in Forge
- Raw card fields
- Full invoice ledger (settings currency only)

### Group F — Frontend panel extension registry

**Owns**

- `apps/frontend/src/plugin-system/**` (catalog, registry, `PluginSlot`, `usePluginExtensions`, `PluginSystemProvider`)
- `apps/frontend/package.json` dependency on `@fluxo/forge` if importing constants/types
- Slot mounts in **features** (not themes): e.g. `features/dashboard/dashboard-page.tsx`, `features/admin/admin-dashboard-page.tsx`, `features/admin/users/*`, `features/settings/settings-page.tsx`, `hooks/use-account-menu.ts` (append items from registry), `features/auth/login-page.tsx`

**Does**

- Register contributions by `PanelExtensionPoint` from `@fluxo/forge`
- Pass extra nav/menu **data** and opaque slot **nodes** (`extraSections`, `extraActions`, `widgets`) into existing theme chrome as props
- Static allowlist of frontend plugin modules (mirror theme catalog — no `import(userString)`)
- Load the catalog from `PluginSystemProvider` next to app providers (not inside `theme-system`); filter with `setEnabledPluginIds`
- Panel modules may call `useUI()` for Fluxo chrome; they must not deep-import `@/themes/...`

**Does not**

- Edit `apps/frontend/src/theme-system/**`
- Edit `apps/frontend/src/theme-system/catalog.ts`
- Add `useUI` keys for plugin widgets (slots are plugin-system, not theme registry)
- Build placeholder product pages (store/cart/invoices) just to host slots

### Group G — Admin inspection API and plugins page

**Owns**

- `apps/api/src/routes/admin-plugins.ts` (or additional routes on `admin.ts` if kept in one file — prefer a dedicated file)
- `apps/frontend/src/routes/_admin/admin/plugins.tsx`
- `apps/frontend/src/features/admin/plugins/**`
- `apps/frontend/src/hooks/use-admin-plugins.ts`
- `apps/frontend/src/themes/default/pages/admin/plugins/**` + register in `themes/default/components.ts` / `UIComponents`
- `apps/frontend/src/themes/default/translations/en.json` keys for the plugins page
- `apps/frontend/src/components/layout/admin-nav.ts` only if labels/paths change (path already exists)

**Does**

- List definitions/instances/health using Forge admin DTOs
- Enable/disable, instance config forms from manifest `config` schema
- Secret fields: follow `AdminSettingsSecretField` + `*Set` pattern
- Health with timeout; strip secrets from messages

**Does not**

- Theme catalog changes
- Example third-party plugins

### Group H — First-party plugin packages (after A–G)

**Owns**

- `pnpm-workspace.yaml` (`plugins/*`)
- `.gitignore` narrowing for `plugins/`
- `plugins/{id}/**` when an actual plugin is added

**Does not** run in parallel with A–G unless a fixture package is required for typecheck.

## Suggested sequence for merge, not calendar time

1. Phase 1 contracts (this branch) — unblocks everyone
2. B (tables) and A (loader) can start together; A may use memory stores until B lands
3. C needs A + B to inject a real context
4. D and E need C
5. G needs A + B + C (D/E for instance tabs)
6. F can start as soon as contracts exist; wire slots when G/F agree on contribution ids
7. H last

## Out of scope until a real product surface exists

- Invoice/order/product schema
- Pterodactyl application API client
- Theme marketplace / plugin marketplace
- Express
- Merging plugins into `useUI`

## Compatibility shims

- `FluxoPlugin.onLoad` / `onUnload` remain optional on the contract as **legacy aliases**. Group A may map `onLoad`→`onStart` and `onUnload`→`onStop` once, then delete the aliases in a follow-up.
- `@fluxo/types` `PluginState` stays until admin DTOs from Forge are used by the API/SPA.
