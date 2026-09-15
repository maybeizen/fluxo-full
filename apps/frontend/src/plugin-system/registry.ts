import {
  isPluginId,
  PANEL_EXTENSION_POINTS,
  type PanelContribution,
  type PanelExtensionPoint,
  type PanelExtensionRegistry,
} from "@fluxo/forge";
import type {
  FrontendPanelContribution,
  RenderablePanelContribution,
} from "./types";

const CONTRIBUTION_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const CONTRIBUTION_ID_MAX_LENGTH = 64;
const PANEL_EXTENSION_POINT_SET = new Set<string>(PANEL_EXTENSION_POINTS);

export function isPanelExtensionPoint(
  value: string,
): value is PanelExtensionPoint {
  return PANEL_EXTENSION_POINT_SET.has(value);
}

export function isContributionId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= CONTRIBUTION_ID_MAX_LENGTH &&
    CONTRIBUTION_ID_PATTERN.test(value)
  );
}

function contributionKey(
  contribution: Pick<
    PanelContribution,
    "pluginId" | "point" | "contributionId"
  >,
): string {
  return `${contribution.pluginId}\0${contribution.point}\0${contribution.contributionId}`;
}

function compareContributions(
  left: PanelContribution,
  right: PanelContribution,
): number {
  const order = (left.order ?? 0) - (right.order ?? 0);
  if (order !== 0) {
    return order;
  }
  const plugin = left.pluginId.localeCompare(right.pluginId);
  if (plugin !== 0) {
    return plugin;
  }
  return left.contributionId.localeCompare(right.contributionId);
}

function isRenderableContribution(
  contribution: FrontendPanelContribution,
  point: PanelExtensionPoint,
): boolean {
  return (
    contribution.point === point && typeof contribution.component === "function"
  );
}

export interface PanelExtensionStore extends PanelExtensionRegistry {
  list(point?: PanelExtensionPoint): readonly FrontendPanelContribution[];
  register(contribution: PanelContribution | FrontendPanelContribution): void;
  getEnabledPluginIds(): ReadonlySet<string> | null;
  setEnabledPluginIds(ids: readonly string[] | null): void;
  listEnabled<P extends PanelExtensionPoint>(
    point: P,
    enabledPluginIds?: readonly string[] | null,
  ): readonly RenderablePanelContribution<P>[];
  reset(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
}

export function createPanelExtensionRegistry(): PanelExtensionStore {
  const contributions = new Map<string, FrontendPanelContribution>();
  const listeners = new Set<() => void>();
  let enabledPluginIds: ReadonlySet<string> | null = null;
  let snapshot = 0;
  const listCache = new Map<string, readonly FrontendPanelContribution[]>();

  function emit(): void {
    snapshot += 1;
    listCache.clear();
    for (const listener of listeners) {
      listener();
    }
  }

  function matchesEnabled(
    pluginId: string,
    filter: ReadonlySet<string> | null | undefined,
  ): boolean {
    if (filter === undefined) {
      filter = enabledPluginIds;
    }
    if (filter === null || filter === undefined) {
      return true;
    }
    return filter.has(pluginId);
  }

  function sorted(
    values: Iterable<FrontendPanelContribution>,
  ): FrontendPanelContribution[] {
    return [...values].sort(compareContributions);
  }

  const store: PanelExtensionStore = {
    list(point) {
      const cacheKey = point ?? "*";
      const cached = listCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      const values = point
        ? [...contributions.values()].filter((entry) => entry.point === point)
        : [...contributions.values()];
      const listed = sorted(values);
      listCache.set(cacheKey, listed);
      return listed;
    },
    register(contribution) {
      if (
        !isPluginId(contribution.pluginId) ||
        !isContributionId(contribution.contributionId)
      ) {
        return;
      }
      if (!isPanelExtensionPoint(contribution.point)) {
        return;
      }
      const key = contributionKey(contribution);
      contributions.set(key, {
        pluginId: contribution.pluginId,
        point: contribution.point,
        contributionId: contribution.contributionId,
        title: contribution.title,
        order: contribution.order,
        component:
          "component" in contribution ? contribution.component : undefined,
      });
      emit();
    },
    getEnabledPluginIds() {
      return enabledPluginIds;
    },
    setEnabledPluginIds(ids) {
      enabledPluginIds = ids === null ? null : new Set(ids);
      emit();
    },
    listEnabled(point, enabledPluginIdsOverride) {
      const filter =
        enabledPluginIdsOverride === undefined
          ? enabledPluginIds
          : enabledPluginIdsOverride === null
            ? null
            : new Set(enabledPluginIdsOverride);
      return store
        .list(point)
        .filter(
          (entry) =>
            isRenderableContribution(entry, point) &&
            matchesEnabled(entry.pluginId, filter),
        ) as RenderablePanelContribution<typeof point>[];
    },
    reset() {
      contributions.clear();
      enabledPluginIds = null;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };

  return store;
}

export const panelExtensionRegistry = createPanelExtensionRegistry();

export function registerPanelContribution<P extends PanelExtensionPoint>(
  contribution: RenderablePanelContribution<P>,
): void {
  panelExtensionRegistry.register(contribution);
}

export function setEnabledPluginIds(ids: readonly string[] | null): void {
  panelExtensionRegistry.setEnabledPluginIds(ids);
}

export function getEnabledPluginIds(): ReadonlySet<string> | null {
  return panelExtensionRegistry.getEnabledPluginIds();
}

export function resetPanelExtensionRegistry(): void {
  panelExtensionRegistry.reset();
}

export function getPanelExtensions<P extends PanelExtensionPoint>(
  point: P,
  enabledPluginIds?: readonly string[] | null,
): readonly RenderablePanelContribution<P>[] {
  return panelExtensionRegistry.listEnabled(point, enabledPluginIds);
}
