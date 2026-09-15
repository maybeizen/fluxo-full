# Plugin loader

Group A owns disk discovery and lifecycle in `@fluxo/plugin-manager`. Group C boots it from the API after DB/Redis are up. Do not call `createPluginManager` from `apps/api/src/app.ts`.

## Wiring

```ts
import { createPluginManager } from "@fluxo/plugin-manager";
import { resolvePluginDirectory } from "./load-path.js";

const manager = createPluginManager({
  directory: env.PLUGINS_DIR,
  logger,
  createContext: (pluginId) => createPluginContext(pluginId),
  getInstallState: (pluginId) => persist.getInstallState(pluginId),
  setInstallState: (pluginId, state) => persist.setInstallState(pluginId, state),
});

await manager.loadAll();
```

`loadAll` discovers packages under `directory`, validates `plugin.json` with `parsePluginManifest`, imports only a realpath-checked `entry`, and calls `onStart` for plugins that are already **installed and enabled**. It does not call install/enable/disable/uninstall on boot.

Graceful shutdown: `await manager.stopAll()` (`onStop` / legacy `onUnload` only).

## Layout

Each plugin is a directory whose name equals `manifest.id`:

```
$PLUGINS_DIR/acme.demo/plugin.json
$PLUGINS_DIR/acme.demo/dist/index.js
```

Path helpers live in `apps/api/src/forge/load-path.ts` (host) and `packages/plugin-manager/src/paths.ts` (loader). Both require `parsePluginId`, reject `..` / absolute / URL-like / NUL / Windows prefixes, and resolve entries with `realpath` + prefix check.

## Fail-safe

Invalid id, bad manifest, `forgeApi` mismatch, duplicate id, missing entry, import throw, or hook throw: log, mark `status: "error"`, keep the rest of Fluxo running. Failed plugins are omitted from `listActive()` / `getActive()`.
