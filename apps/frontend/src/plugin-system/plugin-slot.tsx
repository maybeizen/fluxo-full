import type { PanelExtensionPoint } from "@fluxo/forge";
import { Component, type ErrorInfo, type ReactNode } from "react";
import type {
  PanelContributionPropsMap,
  PanelSlotProps,
  RenderablePanelContribution,
} from "./types";
import { usePluginExtensions } from "./use-plugin-extensions";

interface BoundaryProps {
  pluginId: string;
  contributionId: string;
  component: unknown;
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
  pluginId: string;
  contributionId: string;
  component: unknown;
}

class PluginContributionBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  override state: BoundaryState = {
    failed: false,
    pluginId: "",
    contributionId: "",
    component: undefined,
  };

  static getDerivedStateFromError(): Pick<BoundaryState, "failed"> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): BoundaryState | null {
    if (
      state.pluginId !== props.pluginId ||
      state.contributionId !== props.contributionId ||
      state.component !== props.component
    ) {
      return {
        failed: false,
        pluginId: props.pluginId,
        contributionId: props.contributionId,
        component: props.component,
      };
    }
    return null;
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

export function PluginContributions<P extends PanelExtensionPoint>({
  contributions,
  slotProps,
}: {
  contributions: readonly RenderablePanelContribution<P>[];
  slotProps: PanelSlotProps<P>;
}) {
  return (
    <>
      {contributions.map((entry) => {
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
            component={Contribution}
          >
            <Contribution {...props} />
          </PluginContributionBoundary>
        );
      })}
    </>
  );
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
  return (
    <PluginContributions
      contributions={contributions ?? registered}
      slotProps={slotProps}
    />
  );
}
