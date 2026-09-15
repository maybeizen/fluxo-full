import { createHash } from "node:crypto";
import { FLUXO_THEME_CATALOG } from "@fluxo/types";
import { Hono } from "hono";
import type { AppBindings } from "../app-bindings.js";
import { avatarPublicUrl, isAvatarFile } from "../auth/avatar.js";
import { emitForgeEvent } from "../forge/events.js";
import type { AuthRouteOptions } from "./account/shared.js";
import { SettingsValidationError } from "../settings/runtime.js";
import { appSettingsPatchSchema } from "../settings/schemas.js";

export const APP_ICON_KEY = "branding/app-icon";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function settingsPublicRoutes(options: AuthRouteOptions) {
  const routes = new Hono<AppBindings>();
  routes.get("/public", (c) => c.json(options.settings.publicView()));
  return routes;
}

export function registerSettingsAdminRoutes(
  routes: Hono<AppBindings>,
  options: AuthRouteOptions,
): void {
  routes.get("/settings", (c) => c.json(options.settings.adminResponse()));

  routes.get("/settings/themes", (c) =>
    c.json({ themes: FLUXO_THEME_CATALOG }),
  );

  routes.patch("/settings", async (c) => {
    const parsed = appSettingsPatchSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }
    try {
      const keys = Object.keys(parsed.data);
      const result = await options.settings.patch(parsed.data);
      await emitForgeEvent("settings.updated", { keys });
      return c.json(result);
    } catch (error) {
      if (error instanceof SettingsValidationError) {
        return c.json({ code: error.code }, 400);
      }
      throw error;
    }
  });

  routes.post("/settings/icon", async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File) || !isAvatarFile(file)) {
      return c.json({ error: "Invalid image" }, 400);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const revision = createHash("sha256")
      .update(bytes)
      .digest("hex")
      .slice(0, 16);
    await options.storage.put(APP_ICON_KEY, bytes, file.type);
    const url = `${avatarPublicUrl(options.config, APP_ICON_KEY)}?v=${revision}`;
    const response = await options.settings.setAppIconKey(
      APP_ICON_KEY,
      revision,
    );
    if (response.settings.appIconUrl === null) {
      return c.json({
        ...response,
        settings: { ...response.settings, appIconUrl: url },
      });
    }
    return c.json(response);
  });

  routes.delete("/settings/icon", async (c) => {
    await options.storage.delete(APP_ICON_KEY);
    return c.json(await options.settings.setAppIconKey(null));
  });
}
