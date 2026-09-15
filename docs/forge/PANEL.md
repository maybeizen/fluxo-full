# Panel plugins (SPA extension points)

Panel plugins contribute extra UI on **existing** Fluxo pages. They do not replace the theme system.

```
Application logic → hooks / services / state → page composition
  → useUI()            Fluxo chrome (theme)
  → usePluginExtensions(point)   plugin contributions
```

## Themes vs plugins

|          | Themes                            | Panel plugins                      |
| -------- | --------------------------------- | ---------------------------------- |
| Location | `apps/frontend/src/theme-system/` | `apps/frontend/src/plugin-system/` |
| Catalog  | `theme-system/catalog.ts`         | `plugin-system/catalog.ts`         |
| Hook     | `useUI()` / `useT()`              | `usePluginExtensions(point)`       |
| Replaces | Fluxo presentation                | nothing — adds UI at named points  |

Do not register plugins in the theme catalog. Do not load panel modules with `import(userString)`. Do not put plugin fetching inside theme components.

## Trust

Frontend plugin JS is **trusted code on Fluxo's origin** (same model as themes). Permissions in `plugin.json` are SDK checks on the host, not a browser sandbox. A panel module can call `useUI()`, `fetch`, or any browser API. Operators install only code they trust. There is no marketplace and no runtime upload of plugin JS.

Do not inject plugin strings with `dangerouslySetInnerHTML`.

## Registry

`panelExtensionRegistry` implements `@fluxo/forge` `PanelExtensionRegistry`:

- `register(contribution)` — host/test API; unknown points and invalid ids are ignored
- `list(point?)` — all registered contributions, stable order (`order`, then `pluginId`, then `contributionId`)
- Enabled plugin ids are a host filter (`setEnabledPluginIds`). `null` means every registered plugin is enabled. The SPA hook uses this filter.

Until the API host feeds enabled ids, tests and local registration enable all registered plugins.

## Wiring (existing surfaces only)

| Point                                                            | Surface                                |
| ---------------------------------------------------------------- | -------------------------------------- |
| `client.shell.accountMenu`                                       | Account menu (`useAccountMenu` extras) |
| `client.dashboard.services` / `.invoices` / `.news` / `.support` | Dashboard tab panels                   |
| `client.settings.section`                                        | Account settings                       |
| `admin.dashboard.widget`                                         | Admin home                             |
| `admin.nav.item`                                                 | Admin sidebar extras                   |
| `admin.users.listAction`                                         | Users table row actions                |
| `admin.users.detailSection`                                      | User edit page                         |
| `admin.settings.section`                                         | Admin settings                         |
| `auth.login.extra`                                               | Login card, after social actions       |

Each contribution is wrapped in an error boundary so one throwing widget does not crash the page.

## How a panel plugin registers a widget

Use **only** `@fluxo/forge` types and `plugin-system` APIs. Do not import `@/themes/...`, Zustand stores, or `@fluxo/db`.

1. Add a static catalog entry (allowlist, like themes):

```ts
export const panelPluginCatalog = {
  "acme.status": () => import("./plugins/acme-status"),
} as const;
```

2. Export `register` from that module (or call `registerPanelContribution` at import time):

```ts
import type { PanelContributionPropsMap, PanelPluginRegistrationApi } from "@/plugin-system";

function StatusWidget(props: PanelContributionPropsMap["admin.dashboard.widget"]) {
  return <p>{props.settings.appName}</p>;
}

export function register(api: PanelPluginRegistrationApi) {
  api.register({
    pluginId: "acme.status",
    point: "admin.dashboard.widget",
    contributionId: "status",
    title: "Status",
    order: 10,
    component: StatusWidget,
  });
}
```

Contribution components receive typed host props (`PluginUserView`, `PluginPublicSettingsView`, and `targetUser` on user-admin points). They do not receive Prisma/Drizzle clients or internal stores.

Host composition:

```tsx
const { AdminDashboard } = useUI();
const { user, settings } = usePanelHostContext();
return (
  <>
    <AdminDashboard items={items} />
    {user ? (
      <PluginSlot
        point="admin.dashboard.widget"
        slotProps={{ user, settings }}
      />
    ) : null}
  </>
);
```
