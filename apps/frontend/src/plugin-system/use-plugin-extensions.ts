import type { PanelExtensionPoint } from "@fluxo/forge";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { loadPanelPluginCatalog } from "./catalog";
import { getPanelExtensions, panelExtensionRegistry } from "./registry";
import type { RenderablePanelContribution } from "./types";

let catalogLoad: Promise<void> | undefined;

function ensurePanelPluginCatalog(): void {
  catalogLoad ??= loadPanelPluginCatalog();
}

function sameExtensions(
  left: readonly unknown[],
  right: readonly unknown[],
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
): readonly RenderablePanelContribution<P>[] {
  const snapshot = useSyncExternalStore(
    panelExtensionRegistry.subscribe,
    panelExtensionRegistry.getSnapshot,
    panelExtensionRegistry.getSnapshot,
  );
  useEffect(() => {
    void ensurePanelPluginCatalog();
  }, []);
  const override = options?.enabledPluginIds;
  const listed = useMemo(() => {
    void snapshot;
    return getPanelExtensions(point, override);
  }, [point, snapshot, override]);
  const stable = useRef(listed);
  if (!sameExtensions(stable.current, listed)) {
    stable.current = listed;
  }
  return stable.current;
}
