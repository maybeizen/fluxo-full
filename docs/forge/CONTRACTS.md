# `@fluxo/forge` public contracts

This is the catalog of **public exports** from `@fluxo/forge`. Parallel agents import these names. Do not add a second plugin SDK.

Package entry: `packages/forge/src/index.ts` → dist barrel.

Semantics that do not belong in TypeScript comments live here.

---

## Version and identity

| Export                               | Kind                            | Semantics                                                                             |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------- |
| `FORGE_API_VERSION`                  | `"0.1.0"`                       | Current Forge API. Manifest `forgeApi` is a semver range against this.                |
| `forgeApiSatisfied(range, version?)` | function                        | Implements `^` / `~` / exact like npm for `x.y.z`. Host **skips** plugins when false. |
| `PLUGIN_TYPES`                       | `["service","gateway","panel"]` | Only legal `plugin.json` `type` values.                                               |
| `PluginType`                         | type                            | Union of `PLUGIN_TYPES`.                                                              |
| `PLUGIN_ID_PATTERN`                  | `RegExp`                        | Canonical id: 1–3 dotted slugs, `a-z0-9-`, no leading hyphen.                         |
| `PLUGIN_ID_MAX_LENGTH`               | `80`                            | Max id length.                                                                        |
| `isPluginId` / `parsePluginId`       | functions                       | Reject traversal, `__proto__`, paths, uppercase.                                      |
| `PluginId`                           | type                            | `string` (validated at parse time, not a brand — author UX).                          |

Directory name on disk **must** equal `manifest.id`. Host uses `@fluxo/s3` `resolveSafePath(PLUGINS_DIR, id)`.

---

## Errors

| Export                     | HTTP-ish `status` | `code`                                                              |
| -------------------------- | ----------------- | ------------------------------------------------------------------- |
| `ForgeError`               | default 500       | caller-supplied                                                     |
| `ForgeValidationError`     | 400               | `forge_validation`                                                  |
| `ForgeManifestError`       | 400               | `forge_manifest`                                                    |
| `ForgePermissionError`     | 403               | `forge_permission`                                                  |
| `ForgeNotFoundError`       | 404               | `forge_not_found`                                                   |
| `ForgeConflictError`       | 409               | `forge_conflict`                                                    |
| `ForgeTimeoutError`        | 504               | `forge_timeout`                                                     |
| `ForgeHttpError`           | 502               | `forge_http`                                                        |
| `ForgeConfigError`         | 400               | `forge_config`                                                      |
| `ForgeUnsupportedApiError` | 409               | `forge_unsupported_api`                                             |
| `forgeErrorBody(error)`    | —                 | `{ error: string; code: string }` matching existing API error shape |

All Forge errors set `override readonly name`. Host maps them in Hono handlers; do not leak stacks to the browser.

---

## Security helpers

| Export                              | Semantics                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `FORBIDDEN_OBJECT_KEYS`             | `__proto__`, `constructor`, `prototype`                                             |
| `assertNoPrototypePollution(value)` | Recurse JSON-like objects/arrays; throw `ForgeValidationError`                      |
| `isSafeRelativeEntry(path)`         | Relative `entry`/`frontend`: no `..`, NUL, absolute, Windows drive                  |
| `REDACTED`                          | `"[redacted]"`                                                                      |
| `SENSITIVE_HEADER_NAMES`            | authorization, cookie, set-cookie, x-api-key, x-auth-token (case-insensitive match) |
| `redactHeaders(headers)`            | Copy with sensitive values replaced                                                 |
| `isSensitiveConfigKey(key, fields)` | True when the manifest field `type` is `secret`                                     |

---

## JSON

| Export            | Semantics                           |
| ----------------- | ----------------------------------- |
| `JsonValue`       | JSON-serializable union             |
| `jsonValueSchema` | Zod for storage/config/job payloads |

---

## Manifest (`plugin.json`)

| Export                           | Semantics                                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| `pluginManifestSchema`           | Authoritative Zod object (strict)                                  |
| `PluginManifest`                 | `z.infer` of that schema                                           |
| `parsePluginManifest(input)`     | Pollution check + Zod; throws `ForgeManifestError`                 |
| `safeParsePluginManifest(input)` | `{ ok: true, data } \| { ok: false, error }`                       |
| `PLUGIN_CONFIG_FIELD_TYPES`      | `text secret number boolean url email select multiselect textarea` |
| `pluginConfigFieldSchema`        | Discriminated union on `type`                                      |
| `PluginConfigField`              | Inferred field                                                     |
| `pluginPermissionSchema`         | One of `PLUGIN_PERMISSIONS`                                        |
| `PLUGIN_PERMISSIONS`             | See permissions section                                            |

Required manifest keys: `id`, `name`, `version` (x.y.z), `type`, `forgeApi`, `entry`.

Optional: `description`, `author`, `homepage`, `config` (array of fields, unique keys), `permissions` (unique), `requires` (`{ pluginId, forgeApi? }[]`), `frontend` (relative module for panel SPA), `contributions` (panel slots declared without executing frontend).

`config` is a **schema**, not values. Values live in Fluxo-managed storage (Group B).

---

## Permissions

`PLUGIN_PERMISSIONS` (SDK checks; not an OS sandbox):

- `config.read` / `config.write` — instance/plugin config (host still loads config for the plugin’s own `ctx.config` even without write)
- `storage.read` / `storage.write` — `ctx.storage`
- `http.outbound` — `ctx.http`
- `events.subscribe` / `events.emit` — `ctx.events`
- `jobs.schedule` — `ctx.jobs`
- `webhooks.receive` — host will route webhooks
- `users.read` — `ctx.users`
- `settings.read` — `ctx.settings` public billing/app subset
- `service.provision` / `service.power` / `service.suspend` — service plugin operations
- `billing.checkout` / `billing.refund` / `billing.webhook` — gateway operations

Missing permission → `ForgePermissionError`. Host implements the check inside adapters, not inside plugin code.

---

## Lifecycle (`FluxoPlugin`)

Abstract class (structural: object literals with `manifest` are valid).

| Hook                  | When                                                          | Idempotency                                               |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `onInstall`           | First successful install of this id (once per install record) | Safe to retry if install row not committed                |
| `onEnable`            | Transition disabled → enabled                                 | No-op if already enabled                                  |
| `onStart`             | Process boot (or hot reload) of an **enabled** plugin         | Not on every request; not a substitute for `onEnable`     |
| `onStop`              | Graceful unload / process shutdown of a started plugin        | Must not throw away remote resources                      |
| `onDisable`           | Enabled → disabled                                            | Stop accepting work; keep data                            |
| `onUninstall`         | Operator uninstall after disable                              | Delete plugin KV/secrets the host has not already dropped |
| `health(ctx, signal)` | Admin inspection                                              | Must honor `AbortSignal`; no secrets in `message`         |
| `onLoad` / `onUnload` | **Legacy** aliases for `onStart` / `onStop`                   | Group A may bridge then remove                            |

Host order on boot: load + validate → for enabled: `onStart`. Install/enable are operator actions, not implicit on boot.

---

## Context (`PluginContext`)

Created by Fluxo. **Trusted `pluginId`.** No `prisma`, `db`, `app`, or `internalServices`.

| Field        | Interface             | Notes                                                          |
| ------------ | --------------------- | -------------------------------------------------------------- |
| `pluginId`   | `PluginId`            | From host, not from plugin self-report                         |
| `instanceId` | `string \| undefined` | Set for service/gateway instance operations                    |
| `logger`     | `PluginLogger`        | Same shape as `FluxoLogger`; already child-bound               |
| `config`     | `PluginConfig`        | `get` / `getSecret` / `all` (secrets omitted from `all`)       |
| `storage`    | `PluginStorage`       | KV namespaced by host; no `forPlugin`                          |
| `events`     | `PluginEvents`        | Subscribe to `ForgeEventMap`; `emitCustom` permissioned        |
| `jobs`       | `PluginJobs`          | `schedule` / `cancel`; names qualified by host                 |
| `http`       | `PluginHttp`          | Allowlisted outbound HTTP                                      |
| `users`      | `PluginUsersApi`      | `getById` → `PluginUserView` (no hashes, no MFA secret)        |
| `settings`   | `PluginSettingsApi`   | `getPublic` → name, base URL, billing currency/locale/timezone |

`PluginConfig.getSecret` is server-only. Never assign it to objects that are `JSON.stringify`’d to the SPA.

---

## Storage

`PluginStorage`: `get` / `set` / `delete` / `keys(prefix?)`. Values `JsonValue`. Keys: `^[a-zA-Z0-9._/-]+$`, no `..`. Host prefixes with plugin id internally. Grow to collections later via key prefixes, not SQL.

---

## Logging and HTTP

| Export                          | Semantics                                                           |
| ------------------------------- | ------------------------------------------------------------------- |
| `PluginLogger`                  | `debug info warn error child`                                       |
| `PluginHttp`                    | `request(PluginHttpRequest): Promise<PluginHttpResponse>`           |
| `FORGE_HTTP_DEFAULT_TIMEOUT_MS` | `10000`                                                             |
| `FORGE_HTTP_MAX_TIMEOUT_MS`     | `60000`                                                             |
| `PluginHttpRequest`             | url, method, headers, body (`JsonValue` or `Uint8Array`), timeoutMs |
| `PluginHttpResponse`            | status, headers, body (`JsonValue` or `Uint8Array`)                 |

Host logs request meta with `redactHeaders`. Empty `PLUGIN_HTTP_ALLOWLIST` → all `ctx.http` calls fail with `ForgePermissionError` or `ForgeHttpError`.

---

## Events and jobs

| Export                             | Semantics                                                    |
| ---------------------------------- | ------------------------------------------------------------ |
| `FORGE_EVENT_NAMES`                | Tuple of core event name strings                             |
| `ForgeEventMap`                    | Payload types                                                |
| `PluginEvents`                     | `on`, `onCustom`, `emitCustom`                               |
| `qualifyEventName(pluginId, name)` | `plugin.{id}.{name}`                                         |
| `PluginJobs`                       | `schedule`, `cancel`                                         |
| `qualifyJobName(pluginId, name)`   | `{id}:{name}`                                                |
| `PluginJobSchedule`                | `name`, optional `payload`, `runAt` (ISO), `delayMs`, `cron` |

Core events (host emits):

- `user.created` `user.updated` `user.deleted` `user.suspended` `user.unsuspended` `user.roleChanged`
- `session.created` `session.destroyed`
- `auth.login` `auth.logout`
- `settings.updated` (`keys: string[]` — never secret values)
- `plugin.installed` `plugin.enabled` `plugin.disabled` `plugin.uninstalled`
- Introduced at the plugin boundary (emit when D/E accept results): `service.provisioned` `service.suspended` `service.terminated` `payment.completed` `payment.failed` `payment.refunded`

Plugins cannot emit core events.

---

## Money

`Money`: `{ amount: number; currency: string }` — **integer minor units**, ISO 4217 currency from `billingCurrency` (default USD). No floats.

---

## Service plugins

| Export                                         | Semantics                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `FluxoServicePlugin`                           | Extends `FluxoPlugin`                                                                          |
| `SERVICE_CAPABILITIES`                         | Stable capability ids                                                                          |
| `ServiceCapability`                            | Union                                                                                          |
| `ProvisioningVariableField`                    | Order-form schema (same field types as config)                                                 |
| `ProvisionAction`                              | `create suspend unsuspend terminate modify reconcile`                                          |
| `ProvisionRequest`                             | `idempotencyKey`, `instanceId`, `serviceId`, `userId`, `action`, `variables`, optional `plan`  |
| `ProvisionResult`                              | `status` `ok\|pending\|failed\|noop`, `remoteId?`, `idempotentReplay?`, `message?`, `runtime?` |
| `PowerAction` / `PowerRequest` / `PowerResult` | start/stop/restart                                                                             |
| `ReconcileRequest`                             | Force read of remote resource                                                                  |
| `ServiceInstance`                              | Configured provider (many per plugin)                                                          |
| `ResolvedServiceProvider`                      | `instance` + `pluginId`                                                                        |
| `ServiceRegistry`                              | `listInstances`, `getInstance`, `resolve(instanceId)`                                          |

Idempotency: same `idempotencyKey` + action → same `remoteId`, `idempotentReplay: true`.

Three config layers:

1. **Plugin/instance admin config** — `plugin.json` `config` (panel URL, API token)
2. **Provisioning variables** — product/order form; `provisioningVariables()`
3. **Runtime** — `ProvisionResult.runtime` + `remoteId` (not Pterodactyl-specific names in Forge)

Capabilities (generic server inventory, not Pterodactyl types):  
`provision.create` `provision.suspend` `provision.unsuspend` `provision.terminate` `provision.modify` `provision.reconcile` `power.start` `power.stop` `power.restart` `access.console` `access.files` `backup.create` `backup.restore` `usage.view` `network.view` `credential.reset` `reinstall`

---

## Gateway plugins

| Export                                                            | Semantics                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `FluxoGatewayPlugin`                                              | Extends `FluxoPlugin`                                                                    |
| `CheckoutMode`                                                    | `redirect` \| `token` \| `offline`                                                       |
| `PaymentStatus`                                                   | `pending processing completed failed canceled refunded`                                  |
| `CreateCheckoutRequest`                                           | idempotencyKey, instanceId, invoiceId, amount, customer, returnUrl, cancelUrl, metadata? |
| `CheckoutResult`                                                  | mode, checkoutId, redirectUrl?, clientToken?, status                                     |
| `RefundRequest` / `RefundResult`                                  | Partial refunds via `Money`                                                              |
| `GatewayInstance` / `ResolvedGatewayProvider` / `GatewayRegistry` | Same instance pattern as services                                                        |
| `PluginWebhookRequest` / `PluginWebhookResult`                    | Raw body for HMAC; `recognized` flag                                                     |
| `FORGE_WEBHOOK_PATH_PREFIX`                                       | `/forge/webhooks`                                                                        |
| `forgeWebhookPath(pluginId, instanceId, name)`                    | Builds namespaced path                                                                   |
| `isSafeWebhookName`                                               | `^[a-z][a-z0-9_-]{0,63}$`                                                                |

No card PAN/CVC fields. No Stripe `PaymentIntent` types. Token mode is a client secret/token string for whatever PSP the plugin uses.

---

## Panel plugins

| Export                   | Semantics                                         |
| ------------------------ | ------------------------------------------------- |
| `FluxoPanelPlugin`       | Extends `FluxoPlugin`; optional `contributions()` |
| `PANEL_EXTENSION_POINTS` | Only **existing** SPA surfaces                    |
| `PanelExtensionPoint`    | Union                                             |
| `PanelContribution`      | pluginId, point, contributionId, title?, order?   |
| `PanelExtensionRegistry` | `list` / `register`                               |
| `PanelFrontendModule`    | Serializable contribution list for SPA catalog    |

Points:

- `client.shell.accountMenu` — `useAccountMenu` items
- `client.dashboard.services` / `.invoices` / `.news` / `.support` — dashboard tab panels (empty states today)
- `client.settings.section` — account settings
- `admin.dashboard.widget` — admin home
- `admin.nav.item` — extra items merged in **app** nav data, then passed to theme chrome
- `admin.users.listAction` / `admin.users.detailSection` — real users admin
- `admin.settings.section` — extra settings tab (not a theme override)
- `auth.login.extra` — login card extra (alongside existing social actions slot)

**Not** points: store, cart, products, invoices ledger, Pterodactyl console (those pages are placeholders or nonexistent). Add points when those surfaces become real.

SPA loads panel modules via a **static catalog**, never the theme catalog.

---

## Registries and definition vs instance

| Export                   | Semantics                                                   |
| ------------------------ | ----------------------------------------------------------- |
| `PluginDefinition`       | Installed code + validated manifest                         |
| `PluginLifecycleStatus`  | `installed disabled enabled started error`                  |
| `PluginRegistry`         | list/get definitions; install/uninstall/enable/disable      |
| `ServiceRegistry`        | instances of **service** plugins                            |
| `GatewayRegistry`        | instances of **gateway** plugins                            |
| `PanelExtensionRegistry` | contributions from **panel** (and optionally other) plugins |

A panel plugin is a definition without provider instances. A service/gateway plugin is one definition + N instances (e.g. two panels, two PSPs).

---

## Admin inspection and health

| Export                    | Semantics                                                                  |
| ------------------------- | -------------------------------------------------------------------------- |
| `PluginDefinitionRecord`  | Admin list/detail metadata                                                 |
| `PluginInstanceRecord`    | Instance row; config public (`PluginConfigPublic` with `secretKeysSet`)    |
| `PluginHealthResult`      | `status` uses `HealthStatus` from `@fluxo/types` (`ok degraded unhealthy`) |
| `PluginHealthSnapshot`    | Result + pluginId + optional instanceId + `checkedAt` + `latencyMs`        |
| `FORGE_HEALTH_TIMEOUT_MS` | `5000` — host aborts `health()` after this                                 |

Health `message` must not include tokens, passwords, or `EncryptedPayload` fields.

---

## Factories

| Export                | Semantics                                        |
| --------------------- | ------------------------------------------------ |
| `definePlugin`        | Identity helper; existing consumers keep working |
| `defineServicePlugin` | Same for service plugins                         |
| `defineGatewayPlugin` | Gateway                                          |
| `definePanelPlugin`   | Panel                                            |

Default export of a plugin module **must** be the object/class instance `define*Plugin` returned. Group A enforces that.

---

## What is not exported (on purpose)

- Drizzle types, `FluxoDatabase`, Redis client
- `EncryptedPayload` (host-only)
- Theme `UIComponents` / `useUI`
- Express `Request`/`Response`
- Pterodactyl/Stripe SDK types
