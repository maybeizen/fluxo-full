import type { PanelExtensionPoint } from "@fluxo/forge";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import { loadPanelPluginCatalog } from "./catalog";
import { getPanelExtensions, panelExtensionRegistry } from "./registry";
import type { FrontendPanelContribution, PanelContributionPropsMap } from "./types";

function enabledKey(ids: readonly string[] | null | undefined): string {
  if (ids === undefined) {
    return "";
  }
  if (ids === null) {
    return "*";
  }
  return ids.join("\0");
}

let catalogLoad: Promise<void> | undefined;

function ensurePanelPluginCatalog(): void {
  catalogLoad ??= loadPanelPluginCatalog();
}

function sameExtensions(
  left: readonly FrontendPanelContribution[],
  right: readonly FrontendPanelContribution[],
): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => entry === right[index]);
}

export function usePluginExtensions<P extends PanelExtensionPoint>(
  point: P,
  options?: { enabledPluginIds?: readonly string[] | null },
): readonly (FrontendPanelContribution<P> & {
  component: ComponentType<PanelContributionPropsMap[P]>;
})[] {
  const snapshot = useSyncExternalStore(
    panelExtensionRegistry.subscribe,
    panelExtensionRegistry.getSnapshot,
    panelExtensionRegistry.getSnapshot,
  );
  useEffect(() => {
    void ensurePanelPluginCatalog();
  }, []);
  const filterKey = enabledKey(options?.enabledPluginIds);
  const override = options?.enabledPluginIds;
  const listed = useMemo(
    () => getPanelExtensions(point, override),
    [point, snapshot, filterKey, override],
  );
  const stable = useRef(listed);
  if (!sameExtensions(stable.current, listed)) {
    stable.current = listed;
  }
  return stable.current;
}
