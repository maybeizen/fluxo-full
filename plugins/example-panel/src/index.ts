import {
  FluxoPanelPlugin,
  definePanelPlugin,
  parsePluginManifest,
  type PanelContributionManifest,
} from "@fluxo/forge";

const CONTRIBUTIONS: readonly PanelContributionManifest[] = [
  {
    point: "admin.dashboard.widget",
    contributionId: "status",
    title: "Example",
    order: 50,
  },
];

const MANIFEST = parsePluginManifest({
  id: "example-panel",
  name: "Example Panel",
  version: "1.0.0",
  type: "panel",
  forgeApi: "^0.1.0",
  entry: "src/index.ts",
  description:
    "Example panel plugin that contributes an admin dashboard widget.",
  author: "Fluxo",
  contributions: [...CONTRIBUTIONS],
});

class ExamplePanelPlugin extends FluxoPanelPlugin {
  override readonly manifest = MANIFEST;

  override contributions(): readonly PanelContributionManifest[] {
    return CONTRIBUTIONS;
  }
}

export default definePanelPlugin(new ExamplePanelPlugin());
