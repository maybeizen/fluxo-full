# Forge trust model

Installed plugins are **trusted executable code** in the same Node.js (and, for panel frontend modules, browser) process as Fluxo.

## What plugins are

This is **Model B** (same as themes): authors may write arbitrary TypeScript/JavaScript. Fluxo does **not** sandbox plugins in an OS VM, seccomp jail, or frozen realm.

Permissions in `plugin.json` are **SDK authorization boundaries**. The host refuses to call privileged helpers when a permission is missing. A malicious plugin can still:

- Use the full Node runtime if it imports `node:fs`, `node:child_process`, etc.
- Read process env if it accesses `process.env`
- Ignore the HTTP allowlist by using its own `fetch`

The loader is the security boundary that operators actually get:

- Only load modules from a resolved path under `PLUGINS_DIR` (or a static catalog `import()`)
- Canonical plugin IDs (no traversal, no `__proto__`)
- Manifest Zod parse + prototype-pollution key rejection
- Fail-safe: invalid/broken plugins are skipped and marked `error`; they are not merged into live registries
- Secrets encrypted with existing `APP_KEY` infrastructure; omitted from admin GET payloads. Production refuses plugin secret writes if `APP_KEY` is empty.
- Runtime permissions are the intersection of the disk `plugin.json` and the install-row snapshot (never grant a permission that is no longer on disk)
- Outbound HTTP helper (`ctx.http`) enforces `PLUGIN_HTTP_ALLOWLIST` and redacts auth headers in logs

## Operator responsibility

Installing a plugin means trusting its code the same way you trust an npm dependency of the API. Document that in any admin UI copy. There is no marketplace and no runtime upload of plugin JS in this design.

## Fail-safe loading

On unknown id, invalid manifest, `forgeApi` mismatch, failed import, duplicate id, or thrown lifecycle hook:

1. Log the error (no secrets)
2. Leave the rest of the process up
3. Do not register service/gateway/panel contributions from that plugin
4. Surface `status: "error"` on admin inspection DTOs

Never `eval`, `new Function`, or `import(userProvidedString)`.

## Themes vs plugins

|          | Themes                    | Plugins                                    |
| -------- | ------------------------- | ------------------------------------------ |
| Purpose  | Presentation of Fluxo     | Domain extensions                          |
| Trust    | Trusted JS in the SPA     | Trusted JS in API (+ optional SPA modules) |
| Catalog  | `theme-system/catalog.ts` | Plugin registry (not the theme catalog)    |
| Replaces | `useUI()` components      | Registries + extension points              |

A plugin must not load through the theme system. A theme must not provision servers or take payments.
