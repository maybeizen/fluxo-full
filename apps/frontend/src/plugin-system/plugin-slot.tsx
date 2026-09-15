import type { PanelExtensionPoint } from "@fluxo/forge";
import { Component, type ErrorInfo, type ReactNode } from "react";
import type { PanelContributionPropsMap, PanelSlotProps, RenderablePanelContribution } from "./types";
import { usePluginExtensions } from "./use-plugin-extensions";

interface BoundaryProps {
  pluginId: string;
  contributionId: string;
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

class PluginContributionBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn(
      `Panel plugin contribution failed (${this.props.pluginId}:${this.props.contributionId})`,
      error,
      info.componentStack,
    );
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return null;
    }
    return this.props.children;
  }
}

export function PluginSlot<P extends PanelExtensionPoint>({
  point,
  contributions,
  slotProps,
}: {
  point: P;
  contributions?: readonly RenderablePanelContribution<P>[];
  slotProps: PanelSlotProps<P>;
}) {
  const registered = usePluginExtensions(point);
  const items = contributions ?? registered;

  return (
    <>
      {items.map((entry) => {
        const Contribution = entry.component;
        const props = {
          ...slotProps,
          pluginId: entry.pluginId,
          contributionId: entry.contributionId,
        } as PanelContributionPropsMap[P];
        return (
          <PluginContributionBoundary
            key={`${entry.pluginId}:${entry.contributionId}`}
            pluginId={entry.pluginId}
            contributionId={entry.contributionId}
          >
            <Contribution {...props} />
          </PluginContributionBoundary>
        );
      })}
    </>
  );
}
