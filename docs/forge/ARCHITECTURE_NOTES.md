# Fluxo architecture notes (Forge plugin system)

Grounded in the repository as of branch `cloud/forge-plugin-system-2be8`. Later agents must treat this file as the map of **what exists today**, not a product wishlist.

## Monorepo

- Package manager: **pnpm 11** workspaces (`pnpm-workspace.yaml`), Node `>=22.18.0`
- Task runner: **Turbo 2** (`turbo.json`)
- TypeScript: catalog `typescript@6`, `module`/`moduleResolution` `NodeNext`, `verbatimModuleSyntax`
- Schema lib: **Zod 4** (`zod: catalog:` → `4.6.4`)
- Tests: **Vitest 5**, config via `@fluxo/config/vitest/node` or `vitest/react`
- Lint: ESLint 10 + `typescript-eslint` via `@fluxo/config/eslint`
- Format: Prettier 3 (`prettier.config.js` re-exports `@fluxo/config/prettier`)
- Builds: `tsdown` for packages and `apps/api` / `apps/cli`; Vite 8 for `apps/frontend`

Workspace globs today:

```
apps/*
packages/*
```

There is **no** `plugins/*` glob yet. Root `.gitignore` ignores the entire `plugins/` directory because `PLUGINS_DIR` defaults to `./plugins` as a **runtime drop folder** for built ESM files (see `.env.example`). That is not a pnpm package tree.

Root scripts (`package.json`): `build`, `dev`, `lint`, `lint:fix`, `types`, `test`, `format`, `format:check`, `clean`.

## Packages

| Package                 | Path                      | Role                                                                           |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `@fluxo/api`            | `apps/api`                | Hono 4 HTTP API                                                                |
| `@fluxo/frontend`       | `apps/frontend`           | Vite SPA (TanStack Router / Query, Zustand)                                    |
| `@fluxo/cli`            | `apps/cli`                | `citty` CLI (`fluxo health`, `settings`, `user role`)                          |
| `@fluxo/forge`          | `packages/forge`          | Public plugin SDK (this phase: contracts)                                      |
| `@fluxo/plugin-manager` | `packages/plugin-manager` | **Stub** disk loader (`.js` files, `onLoad`/`onEnable`/`onDisable`/`onUnload`) |
| `@fluxo/types`          | `packages/types`          | Shared DTOs/enums (auth, settings, slim plugin stub)                           |
| `@fluxo/db`             | `packages/db`             | Drizzle ORM + postgres.js                                                      |
| `@fluxo/crypto`         | `packages/crypto`         | AES-256-GCM `encrypt`/`decrypt`/`generateKey`                                  |
| `@fluxo/logger`         | `packages/logger`         | Winston wrapper `FluxoLogger`                                                  |
| `@fluxo/redis`          | `packages/redis`          | Redis client (`ioredis`-style `createRedis`)                                   |
| `@fluxo/s3`             | `packages/s3`             | Local/S3 storage + **path traversal guards**                                   |
| `@fluxo/config`         | `packages/config`         | Shared ESLint/TS/Vitest/Prettier                                               |

## Existing Forge SDK (`packages/forge`)

**Status before this phase:** a stub.

- Exports: `definePlugin`, types `FluxoPlugin`, `PluginContext`
- `PluginContext` was `{ logger: FluxoLogger; config: Readonly<Record<string, unknown>> }`
- Lifecycle was `onLoad` / `onEnable` / `onDisable` / `onUnload`
- Manifest type was imported from `@fluxo/types` (`id`, `name`, `version`, `description?`)
- Version: `0.0.0` private workspace package
- Tests: `packages/forge/src/define-plugin.test.ts`

The only in-repo consumer is `@fluxo/plugin-manager`. The API process does **not** currently construct a plugin manager (env vars exist; boot in `apps/api/src/index.ts` does not load plugins).

## Theme system (do not merge plugins here)

Location: `apps/frontend/src/theme-system/`

- Catalog allowlist: `apps/frontend/src/theme-system/catalog.ts` (`default`, `example`)
- Manifest Zod: `apps/frontend/src/theme-system/manifest.ts`
- Resolver: `apps/frontend/src/theme-system/resolve.ts` (one-level `extends`, fallback to default)
- `useUI()`: `apps/frontend/src/theme-system/use-ui.ts`
- `useT()`: `apps/frontend/src/theme-system/use-t.ts`
- Default implementations: `apps/frontend/src/themes/default/components.ts` → `UIComponents` in `apps/frontend/src/registry/types.ts`
- Active theme: public setting `activeThemeId` (`packages/types/src/app-settings.ts`) → `VITE_PUBLIC_THEME` → `"default"`

**Plugins must not** register in `themeCatalog`, replace `useUI` keys, or live under `theme-system/`. Panel contributions use a **plugin extension-point registry** (contracts in `@fluxo/forge`; implementation later under `apps/frontend/src/plugin-system/`).

## Backend

- Entrypoint: `apps/api/src/index.ts` (loads repo-root `.env`, logger, Postgres, Redis, auth, `createApp`, `@hono/node-server`)
- App factory: `apps/api/src/app.ts` (CORS, `errorHandler`, request logger)
- Bindings: `apps/api/src/app-bindings.ts` (`session`, `user`, `account`)
- Env: `apps/api/src/env.ts` (Zod). Plugin-related: `PLUGINS_DIR` (default `./plugins`), `PLUGIN_HTTP_ALLOWLIST` (comma-separated hosts; empty = no outbound plugin HTTP)
- No DI container. Factories: `createAuthServices`, `createDatabase`, `createRedis`, `createStorage`, `createSettingsRuntime`

### Routes (Hono, REST, not tRPC)

| Mount       | File                              | Auth                                           |
| ----------- | --------------------------------- | ---------------------------------------------- |
| `/health`   | `apps/api/src/routes/health.ts`   | public                                         |
| `/settings` | `apps/api/src/routes/settings.ts` | public GET; admin PATCH                        |
| `/auth`     | `apps/api/src/routes/auth.ts`     | mixed                                          |
| `/admin`    | `apps/api/src/routes/admin.ts`    | session + `requireAdmin`                       |
| `/files`    | `apps/api/src/routes/files.ts`    | public GET for `avatars/` and `branding/` keys |

Account sub-routes: `apps/api/src/routes/account/*` (profile, sessions, MFA, passkeys, email/password, step-up).

### Request validation and errors

- Bodies parsed with Zod (`apps/api/src/auth/schemas.ts`, `apps/api/src/settings/schemas.ts`)
- Invalid JSON → treat as `null`, then `400 { error: "Invalid request" }`
- Unauthenticated: `{ error: "Unauthorized" }` or `{ code: "mfa_required" }` / `{ code: "step_up_required" }`
- Forbidden: `{ error: "Forbidden" }` or `{ code: "cannot_delete_self" | ... }`
- Unhandled: `apps/api/src/middleware/error.ts` → `{ error: "Internal Server Error" }`
- SPA client schema: `apps/frontend/src/lib/auth.ts` `authErrorBodySchema` (`message?`, `error?`, `code?`)

**No rate limiter and no global body-size cap** exist on the Hono app today. Uploads use multer (`packages/s3/src/upload.ts`) without an explicit size limit in that helper.

## Auth / authorization

- Roles: `UserRole.User | UserRole.Admin` (`packages/types/src/auth.ts`)
- Sessions: HMAC-signed cookie (`apps/api/src/auth/cookie.ts`, `session.ts`), stores in Redis/Postgres/memory (`apps/api/src/auth/stores/*`)
- Admin: `apps/api/src/auth/require-admin.ts` (role check after `requireSession`)
- Step-up: `apps/api/src/routes/account/step-up.ts` (TOTP/passkey); SPA `apps/frontend/src/features/settings/use-step-up.ts`
- MFA secrets sealed with `APP_KEY` via `apps/api/src/auth/mfa.ts` (`sealMfaSecret` / `openMfaSecret`)
- Passwords: bcrypt (`apps/api/src/auth/passwords.ts`)
- WebAuthn: `@simplewebauthn/server`

There is no per-route RBAC beyond admin vs user. Plugin permissions are **new** SDK authorization boundaries, not existing middleware.

## Database

- **Drizzle ORM 0.45** + **PostgreSQL** (`packages/db`)
- Migrations: `packages/db/drizzle/` (`0000`, `0001`, `0002`); generate/migrate scripts on `@fluxo/db`
- Schema barrel: `packages/db/src/schema/index.ts`
- Tables **today**: `users`, `sessions`, `auth_tokens`, `mfa_backup_codes`, `webauthn_credentials`, `step_up_challenges`, `fluxo_meta`
- Settings KV: `fluxo_meta` (`packages/db/src/schema/meta.ts`) key `app.settings` (`apps/api/src/settings/store.ts`)
- **No** services, invoices, products, payments, plugins, jobs, or webhooks tables

Plugin KV / installs / instances / secrets should be **new Drizzle tables** in `packages/db` (later phase). Do not stuff plugin data into `fluxo_meta` except perhaps a bootstrap flag. Do not give plugins `db`/`prisma`.

## Secret management (reuse this; do not invent a key)

- Master key: env `APP_KEY` (`.env.example`, `apps/api/src/env.ts`)
- Algorithm: AES-256-GCM, 32-byte key (hex or base64), 12-byte IV, 16-byte tag — `packages/crypto/src/keys.ts`, `aes.ts`
- Wire type: `EncryptedPayload` `{ iv, tag, ciphertext }` (`packages/types/src/crypto.ts`)
- Settings secrets: `apps/api/src/settings/secrets.ts` `sealSecret` / `openSecret` / `applySecretPatch`
- Settings persist: `apps/api/src/settings/persist.ts` seals SMTP password, S3 keys, captcha secret
- Admin API **never returns secret values**; it returns `*Set: boolean` (`toAdminSettings` in `apps/api/src/settings/defaults.ts`)
- SPA secret fields: `apps/frontend/src/themes/default/pages/admin/settings/secret-field.tsx` (placeholder when set; patch `string | null`)
- If `APP_KEY` is empty, `sealSecret` stores plaintext (dev). Production must set `APP_KEY`.

**Plugin secrets must use `sealSecret`/`openSecret` + `APP_KEY`.** Same `EncryptedPayload` shape. Never log plaintext. Never send values to the browser after save.

## Config / settings

- Runtime: `apps/api/src/settings/runtime.ts`
- Public vs admin DTOs: `packages/types/src/app-settings.ts`
- Billing **settings only** (currency, locale, timezone, invoice prefix/due days, tax, company). No invoice documents.
- CLI local file settings: `apps/cli/src/settings.ts` (separate from Postgres app settings)

## Queue / jobs

**None.** No BullMQ, pg-boss, or worker process. Redis is used for sessions/health, not a job queue.

Forge jobs are a **mediated scheduler contract**. Host may start with in-process timers and later persist in Redis/Postgres. Plugins must not import a queue library.

## Logging

- `createLogger({ service, level?, directory? })` → `FluxoLogger` (`debug|info|warn|error|child`)
- File + color console; JSON file transport when `directory` set
- **No built-in secret redaction.** Host plugin loggers must wrap `child({ plugin: id })` and redact headers/config secrets using Forge helpers.

## HTTP client

- SPA: `fetch` + `credentials: "include"` (`apps/frontend/src/lib/auth-api.ts`, `lib/api.ts`)
- No shared server HTTP client. Plugin outbound HTTP is new; must honor `PLUGIN_HTTP_ALLOWLIST` and timeouts, and must not log `Authorization` / `Cookie` / API keys.

## Webhooks

**None** in the API today. Gateway plugins register handlers through the SDK; the host mounts **Hono** (not Express) at `/forge/webhooks/{pluginId}/{instanceId}/{name}`.

## Billing / payments / invoices

**Settings only.** No Stripe (or other) integration, no invoice table, no checkout session, no refunds.

Real UI: admin settings billing tab (`apps/frontend/src/themes/default/pages/admin/settings/billing-tab.tsx`).

Placeholder routes (copy only): `/invoices`, `/store`, `/cart`, `/admin/invoices`, `/admin/coupons`, `/admin/products`, `/admin/categories`, `/admin/configurable-options`.

Gateway contracts are provider-neutral so a future Stripe (or other) plugin can implement them **without** baking Stripe types into Forge.

## Services / products / Pterodactyl

**None.** No Pterodactyl client, no service records, no product catalog.

- Client `/services`: placeholder (`apps/frontend/src/routes/_app/services.tsx`)
- Client `/servers`: empty-state card, “No servers are connected yet.” (`apps/frontend/src/features/servers/servers-page.tsx`)
- Admin `/admin/services`, `/admin/products`: placeholders
- Dashboard services/invoices panels: **registered theme empty states** (`themes/default/pages/dashboard/dashboard-services-panel.tsx`, `dashboard-invoices-panel.tsx`)

Service plugin DTOs are **Forge-owned and panel-agnostic**. Capabilities are modeled on a generic game/server inventory (power, console, files, backups), not Pterodactyl field names.

## Admin UI that actually exists

Implemented (not placeholders):

- Admin dashboard: `apps/frontend/src/features/admin/admin-dashboard-page.tsx`
- Users list/detail: `features/admin/users/*` + API `GET/POST/PATCH/DELETE /admin/users`
- Settings: `features/admin/settings/*` + API settings admin routes
- Nav data: `apps/frontend/src/components/layout/admin-nav.ts`

Placeholders (`AdminPlaceholderRoute`): plugins, services, invoices, products, categories, support, coupons, configurable-options, news.

Client implemented: landing, auth flows, dashboard, settings (profile/password/MFA/passkeys/sessions/step-up), servers empty state.

Client placeholders: services, invoices, store, cart, support, news.

## Frontend routing and split

- TanStack Router file routes: `apps/frontend/src/routes/`
- Features compose hooks + `useUI()`/`useT()`: `apps/frontend/src/features/`
- Themes: `apps/frontend/src/themes/{default,example}/`
- HTTP/session: `apps/frontend/src/lib/`, `hooks/`
- Nav **data** in the app (`app-nav.ts`, `admin-nav.ts`, `marketing-links.ts`), passed into theme chrome as props

## Path safety

Reuse `packages/s3/src/keys.ts`: `assertSafeKey`, `resolveSafePath` (blocks `..`, NUL, absolute paths). Plugin id → directory resolution must use this pattern. Do not `import(userString)`.

## Prototype-pollution-safe parsing

Zod objects with explicit keys (see `appSettingsPatchSchema`). Persisted settings are field-whitelisted in `apps/api/src/settings/persist.ts` (`asString` / `asBoolean` / …), not `Object.assign` into a prototype. Forge manifest parsing must additionally **reject** keys `__proto__`, `constructor`, `prototype`.

## Events the app emits today

**No domain event bus.** Auth and settings mutations happen inline. Forge introduces a **stable event catalog at the plugin boundary**. Host adapters emit those events when existing code paths run (user CRUD, session create/destroy, login, settings save) and when service/gateway results are accepted.

## Adding `/plugins/{id}` packages

Today:

1. `pnpm-workspace.yaml` does not include `plugins/*`
2. `.gitignore` ignores `plugins/` entirely
3. Stub loader reads `*.js` (not `*.test.js`) from `PLUGINS_DIR`

Later, when source plugins become workspace packages:

- Add `plugins/*` to `pnpm-workspace.yaml`
- Narrow gitignore to `plugins/*/dist/` (keep runtime drop-ins untracked if needed)
- Each plugin: `plugins/{id}/package.json` with `"name": "@fluxo/plugin-{id}"` (or unscoped), `"exports"` pointing at `dist`, dependency `@fluxo/forge`
- Catalog/allowlist loading (static `import()` like themes) for trusted first-party plugins; disk load for operator-installed ESM still goes through ID + path checks

Do not create empty `plugins/` directories in this phase.

## Test conventions

- Colocated `*.test.ts` / `*.test.tsx` next to source
- Vitest `passWithNoTests: true` for node packages
- Frontend: Testing Library + jsdom (`@fluxo/config/vitest/react`)
- Run one package: `pnpm --filter @fluxo/forge test` (and `types`, `lint`, `build`)
- Run all: `pnpm test` / `pnpm types` / `pnpm lint` / `pnpm build` from repo root

## Docs conventions

There was **no** `docs/` tree before this phase. Forge docs live under `docs/forge/`. Code comments are not used; semantics live in `CONTRACTS.md` and these notes.
