# Plugin persistence

Host-side storage for Fluxo Forge. Plugins never receive a database client. Group C wraps these repositories as `PluginStorage` / config APIs.

## Tables

| Table              | Purpose                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plugin_installs`  | Package/definition state: id, type, version, enabled, lifecycle status, error, discovered path/hash, manifest snapshot                                             |
| `plugin_instances` | Configured service/gateway instances of a plugin (many per definition). Foreign key to installs uses `ON DELETE RESTRICT`.                                         |
| `plugin_kv`        | Namespaced JSON KV. Composite primary key `(plugin_id, key)`. **No FK to installs.**                                                                               |
| `plugin_secrets`   | Sealed secrets per plugin and optional instance. Unique `(plugin_id, instance_id, key)` with empty `instance_id` for plugin-scoped secrets. **No FK to installs.** |

Uninstall deletes the install row only. KV and secrets are retained until `purgeKv` / `purgeSecrets` or `uninstall(id, { purgeStorage: true })`. Uninstall is blocked while instances exist; disabling a definition is blocked while enabled instances exist.

## Namespace and keys

Storage methods take a canonical plugin id from the **trusted host**, never a plugin-supplied `forPlugin`. Collection/key identifiers must match Forge `isSafeStorageKey` (no traversal, no empty segments, no `__proto__` / `constructor` / `prototype`). Keys are bound parameters, never SQL identifiers.

## Config and secrets

`plugin.json` `config` is a schema only. Values live in instance `config` JSON plus `plugin_secrets`. `validatePluginConfig` is server-side and authoritative (types, required, defaults, min/max, select options). Prototype-pollution keys are rejected. User-supplied regex is not executed.

Secrets use `sealSecret` / `openSecret` with `APP_KEY` (AES-256-GCM via `@fluxo/crypto`). Empty `APP_KEY` stores plaintext, matching settings. Admin DTO helpers expose `secretKeysSet` and never secret values.
