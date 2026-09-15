# Fluxo Forge

Plugin system docs for later implementation groups.

| File                                               | Purpose                                       |
| -------------------------------------------------- | --------------------------------------------- |
| [ARCHITECTURE_NOTES.md](./ARCHITECTURE_NOTES.md)   | What exists in the repo today                 |
| [CONTRACTS.md](./CONTRACTS.md)                     | Public `@fluxo/forge` exports and semantics   |
| [TRUST.md](./TRUST.md)                             | Trusted code + SDK permissions, not a sandbox |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Parallel group file ownership                 |
| [PANEL.md](./PANEL.md)                             | SPA panel extension registry (Group F)        |

Import contracts from `@fluxo/forge`. Do not put plugin loading in `apps/frontend/src/theme-system/`.
