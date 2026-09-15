import { isPluginId } from "@fluxo/forge";
import { Hono } from "hono";
import type { AppBindings } from "../app-bindings.js";
import type { PluginPersist } from "../forge/persist.js";

export function panelPluginPublicRoutes(options: {
  persist: Pick<PluginPersist, "listInstalls">;
}) {
  const routes = new Hono<AppBindings>();
  routes.get("/panel", async (c) => {
    const installs = await options.persist.listInstalls();
    const pluginIds = installs
      .filter((row) => row.enabled && row.type === "panel" && isPluginId(row.id))
      .map((row) => row.id)
      .sort();
    return c.json({ pluginIds });
  });
  return routes;
}
