# Fluxo Forge

Plugin system docs for later implementation groups.

| File                                               | Purpose                                       |
| -------------------------------------------------- | --------------------------------------------- |
| [ARCHITECTURE_NOTES.md](./ARCHITECTURE_NOTES.md)   | What exists in the repo today                 |
| [CONTRACTS.md](./CONTRACTS.md)                     | Public `@fluxo/forge` exports and semantics   |
| [TRUST.md](./TRUST.md)                             | Trusted code + SDK permissions, not a sandbox |
| [LOADER.md](./LOADER.md)                           | Disk discovery, `plugin.json`, and lifecycle  |
| [SERVICE.md](./SERVICE.md)                         | Service plugin instances                      |
| [GATEWAY.md](./GATEWAY.md)                         | Gateway plugin instances and webhooks         |
| [PANEL.md](./PANEL.md)                             | SPA panel extension registry (Group F)        |
| [ADMIN.md](./ADMIN.md)                             | Admin plugin API + UI (Group G)               |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Parallel group file ownership                 |

Import contracts from `@fluxo/forge`. Do not put plugin loading in `apps/frontend/src/theme-system/`.

## Trust

Installing a plugin installs **trusted executable code** in the same Node.js process as the API (and, for panel frontend modules, in the browser on Fluxo's origin). There is no OS sandbox. Treat a plugin the way you treat an npm dependency of the API. See [TRUST.md](./TRUST.md).

## Creating a plugin

Workspace example packages (copy these; do not invent production Stripe or Pterodactyl plugins from them):

| Directory                 | Package                         | Type    |
| ------------------------- | ------------------------------- | ------- |
| `plugins/example-service` | `@fluxo/plugin-example-service` | service |
| `plugins/example-gateway` | `@fluxo/plugin-example-gateway` | gateway |
| `plugins/example-panel`   | `@fluxo/plugin-example-panel`   | panel   |

1. Create `plugins/{id}/` where `{id}` equals `plugin.json` `id` (canonical plugin id: lowercase dotted slugs).
2. Add `plugin.json`, `package.json`, and `src/`. Authors may organize `src/` freely.
3. Required manifest fields: `id`, `name`, `version`, `type`, `forgeApi` (semver range against `FORGE_API_VERSION`, currently `^0.1.0`), `entry`.
4. Default-export a `defineServicePlugin` / `defineGatewayPlugin` / `definePanelPlugin` instance. Import **only** `@fluxo/forge` from plugin `entry` code. Do not import `@fluxo/db`, Prisma, or `apps/api` services. Panel **React** widgets are not loaded from `plugin.json` `frontend`; they register through Fluxo's static SPA catalog (`apps/frontend/src/plugin-system/catalog.ts`) using `@/plugin-system` types (Fluxo app internals, not a published SDK). Those widgets may call `useUI()` / `useT()` for Fluxo chrome and must not deep-import `@/themes/...`.
5. `entry` must be a relative path the loader can import (these examples use `src/index.ts`; Node `>=22.18` type-strips it. Drop-in plugins may use `dist/index.js` after `tsdown`).
6. List only the `permissions` the plugin actually uses. Config in `plugin.json` is a schema, not secret values.

Panel frontend modules are a **static catalog**, not a dynamic `import(userString)`:

```ts
export const panelPluginCatalog = {
  "example-panel": () => import("./plugins/example-panel"),
} as const;
```

Register the widget with `register()` and typed contribution props. See `apps/frontend/src/plugin-system/plugins/example-panel.tsx` and [PANEL.md](./PANEL.md).

## Loading

`PLUGINS_DIR` defaults to `./plugins`. The API host calls `createPluginManager({ directory: env.PLUGINS_DIR, ... })` then `loadAll()`. Enabled installed plugins `onStart`; malformed siblings and incompatible `forgeApi` ranges are skipped.

```sh
pnpm --filter @fluxo/plugin-example-service test
pnpm --filter @fluxo/plugin-manager test
```
