import { isPluginId } from "@fluxo/forge";
import { registerPanelContribution } from "./registry";
import type { PanelPluginModule, ResolvablePanelCatalog } from "./types";

export const panelPluginCatalog = {
  "example-panel": () => import("./plugins/example-panel"),
} as const;

export type PanelPluginCatalogId = keyof typeof panelPluginCatalog;

export function parsePanelPluginCatalogId(
  value: string | undefined,
  catalog: Record<string, unknown> = panelPluginCatalog,
): string | undefined {
  if (
    typeof value === "string" &&
    value.length > 0 &&
    Object.hasOwn(catalog, value)
  ) {
    return value;
  }
  return undefined;
}

function isPanelPluginModule(value: unknown): value is PanelPluginModule {
  return typeof value === "object" && value !== null;
}

export async function loadPanelPluginCatalog(
  catalog: ResolvablePanelCatalog = panelPluginCatalog as ResolvablePanelCatalog,
  shouldApply?: () => boolean,
): Promise<void> {
  const resolved =
    catalog ?? (panelPluginCatalog as ResolvablePanelCatalog);
  const ids = Object.keys(resolved).filter(
    (id) => Object.hasOwn(resolved, id) && isPluginId(id),
  );
  const loaded = await Promise.all(
    ids.map(async (id) => {
      const loader = resolved[id];
      if (typeof loader !== "function") {
        return undefined;
      }
      try {
        return await loader();
      } catch (error) {
        console.warn(`Failed to load panel plugin ${id}`, error);
        return undefined;
      }
    }),
  );
  if (shouldApply && !shouldApply()) {
    return;
  }
  for (const module of loaded) {
    if (!isPanelPluginModule(module) || typeof module.register !== "function") {
      continue;
    }
    module.register({ register: registerPanelContribution });
  }
}
