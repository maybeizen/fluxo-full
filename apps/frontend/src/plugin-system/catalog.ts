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
): Promise<void> {
  await Promise.all(
    Object.keys(catalog).map(async (id) => {
      if (!Object.hasOwn(catalog, id) || !isPluginId(id)) {
        return;
      }
      const loader = catalog[id];
      if (typeof loader !== "function") {
        return;
      }
      try {
        const loaded = await loader();
        if (!isPanelPluginModule(loaded)) {
          return;
        }
        if (typeof loaded.register === "function") {
          loaded.register({ register: registerPanelContribution });
        }
      } catch (error) {
        console.warn(`Failed to load panel plugin ${id}`, error);
      }
    }),
  );
}
