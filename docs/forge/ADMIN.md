# Admin plugin inspection

Group G owns the admin inspection API and plugins page. Routes are **not** mounted in `apps/api/src/app.ts` yet.

## Mount

```ts
import { adminPluginRoutes } from "./routes/admin-plugins.js";

app.route("/admin", adminPluginRoutes({
  sessions: auth.sessions,
  users: auth.users,
  passkeys: auth.passkeys,
  persist,
  manager,
  createContext: (pluginId, instanceId) => host.createContext(pluginId, instanceId),
}));
```

`persist` is `createPostgresPluginPersist` / `createMemoryPluginPersist`. `manager` and `createContext` are optional so this compiles before Group C boots Forge. Prefer injecting them from the host factory; do not import `boot.ts`.

Export: `adminPluginRoutes` from `apps/api/src/routes/admin-plugins.ts`. Helpers: `createAdminPluginService` in `apps/api/src/forge/admin-plugins.ts`.

## Auth

Same guards as other admin APIs: `requireSession` then `requireAdmin`. Unauthenticated `{ error: "Unauthorized" }` 401. Non-admin `{ error: "Forbidden" }` 403. Forge errors use `{ error, code }` via `forgeErrorBody` and never include stack traces or secret values.

## HTTP

Mounted at `/admin` (once the one-liner is added):

| Method | Path | Action |
| --- | --- | --- |
| GET | `/plugins` | List installed and discovered definitions |
| GET | `/plugins/:pluginId` | One definition |
| POST | `/plugins/:pluginId/enable` | Enable (manager enable + persist) |
| POST | `/plugins/:pluginId/disable` | Disable; 409 `forge_conflict` when enabled instances exist (`assertCanDisable`) |
| DELETE | `/plugins/:pluginId` | Uninstall. KV/secrets kept unless `?purgeStorage=true` (or JSON `{ "purgeStorage": true }`) |
| GET | `/plugins/:pluginId/config` | Manifest schema + non-secret values + `secretKeysSet` |
| PUT | `/plugins/:pluginId/config` | `validatePluginConfig`; secrets sealed; blank secret keeps the saved value; `null` clears |
| POST | `/plugins/:pluginId/health` | On-demand health (5s timeout) |
| GET | `/plugins/:pluginId/instances` | Instance list |
| POST | `/plugins/:pluginId/instances` | Create (`displayName`, optional `enabled`) |
| GET | `/plugins/:pluginId/instances/:instanceId` | One instance |
| PATCH | `/plugins/:pluginId/instances/:instanceId` | Update name/enabled |
| POST | `/plugins/:pluginId/instances/:instanceId/enable` | Enable instance |
| POST | `/plugins/:pluginId/instances/:instanceId/disable` | Disable instance |
| DELETE | `/plugins/:pluginId/instances/:instanceId` | Delete instance |
| GET/PUT | `/plugins/:pluginId/instances/:instanceId/config` | Instance config (same secret rules) |
| POST | `/plugins/:pluginId/instances/:instanceId/health` | Instance health |

Plugin-level non-secret config is stored in plugin KV at `fluxo/admin-config`. Secrets use `plugin_secrets` (plugin-scoped or instance-scoped). GET never returns secret values.

List items add `enabled`, `installed`, `discovered`, and `compatibility` (`ok`, `forgeApi`, `hostVersion`) on top of `PluginDefinitionRecord`.

## UI

- `/admin/plugins` — list (nav item already exists)
- `/admin/plugins/$pluginId` — detail, generated config form, instances for service/gateway

Theme keys: `AdminPluginsPage`, `AdminPluginsTable`, `AdminPluginDetailPage`, `AdminPluginConfigForm`, `AdminPluginInstancesCard`. Features call hooks + `useUI()` / `useT()`. Client-side validation is type/required/min/max/options only (no schema regex). Server validation is authoritative.

Installing a plugin is trusted executable code (same as an API npm dependency). That notice is on the list page.

Root `.gitignore` has `plugins/`, so frontend sources under `features/admin/plugins/`, `themes/default/pages/admin/plugins/`, and `routes/_admin/admin/plugins/` must be `git add -f`'d. Vitest skips gitignored paths, so plugin admin tests live next to the other admin tests (`plugins-page.test.tsx`, `plugin-detail-page.test.tsx`, `plugin-config-validate.test.ts`). Do not broaden that ignore; it is the runtime drop folder for built plugin packages.
