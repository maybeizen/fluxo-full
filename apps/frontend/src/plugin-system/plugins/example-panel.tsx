import type {
  PanelContributionPropsMap,
  PanelPluginRegistrationApi,
} from "../types";

export function ExamplePanelStatusWidget(
  props: PanelContributionPropsMap["admin.dashboard.widget"],
) {
  return (
    <section data-testid="example-panel-status">
      <p>{props.settings.appName}</p>
    </section>
  );
}

export function register(api: PanelPluginRegistrationApi) {
  api.register({
    pluginId: "example-panel",
    point: "admin.dashboard.widget",
    contributionId: "status",
    title: "Example",
    order: 50,
    component: ExamplePanelStatusWidget,
  });
}
