import type { StorageDriver } from "@fluxo/s3";
import { Hono } from "hono";

export function fileRoutes(storage: StorageDriver) {
  const routes = new Hono();

  routes.get("/*", async (c) => {
    const key = c.req.path.replace(/^\/files\//, "");
    if (!key.startsWith("avatars/") && !key.startsWith("branding/")) {
      return c.json({ error: "Not found" }, 404);
    }

    try {
      const body = await storage.get(key);
      const branding = key.startsWith("branding/");
      return new Response(body, {
        headers: {
          "content-type": "application/octet-stream",
          "cache-control": branding
            ? "private, no-cache, must-revalidate"
            : "private, max-age=3600",
        },
      });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  });

  return routes;
}
