import {
  ForgeError,
  ForgeValidationError,
  forgeErrorBody,
  jsonValueSchema,
  parseInstanceId,
  parsePluginId,
  type JsonValue,
} from "@fluxo/forge";
import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../app-bindings.js";
import { requireAdmin } from "../auth/require-admin.js";
import { requireSession } from "../auth/require-session.js";
import type { SessionEngine } from "../auth/session.js";
import type { PasskeyStore, UserStore } from "../auth/stores/types.js";
import {
  createAdminPluginService,
  type AdminPluginContextFactory,
  type AdminPluginManager,
  type AdminPluginService,
} from "../forge/admin-plugins.js";
import type { PluginPersist } from "../forge/persist.js";

const jsonRecordSchema = z.record(z.string(), jsonValueSchema);
const uninstallQuerySchema = z.object({
  purgeStorage: z
    .enum(["1", "true", "yes"])
    .optional()
    .transform((value) => value !== undefined),
});
const uninstallBodySchema = z.object({
  purgeStorage: z.boolean().optional(),
});
const createInstanceBodySchema = z.object({
  displayName: z.string().min(1).max(80),
  enabled: z.boolean().optional(),
  config: jsonRecordSchema.optional(),
});
const updateInstanceBodySchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
});

export interface AdminPluginRouteOptions {
  sessions: SessionEngine;
  users: UserStore;
  passkeys?: PasskeyStore;
  persist: PluginPersist;
  manager?: AdminPluginManager;
  createContext?: AdminPluginContextFactory;
  service?: AdminPluginService;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function pluginParam(value: string): string {
  return parsePluginId(value);
}

function instanceParam(value: string): string {
  return parseInstanceId(value);
}

function handleForgeError(error: unknown): { body: { error: string; code: string }; status: number } | null {
  if (error instanceof ForgeError) {
    return { body: forgeErrorBody(error), status: error.status };
  }
  return null;
}

export function adminPluginRoutes(options: AdminPluginRouteOptions) {
  const service =
    options.service ??
    createAdminPluginService({
      persist: options.persist,
      manager: options.manager,
      createContext: options.createContext,
    });
  const routes = new Hono<AppBindings>();
  routes.use(
    "*",
    requireSession({
      sessions: options.sessions,
      users: options.users,
      passkeys: options.passkeys,
    }),
    requireAdmin(),
  );

  routes.get("/plugins", async (c) => {
    return c.json({ plugins: await service.list() });
  });

  routes.get("/plugins/:pluginId", async (c) => {
    try {
      return c.json(await service.get(pluginParam(c.req.param("pluginId"))));
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.post("/plugins/:pluginId/enable", async (c) => {
    try {
      return c.json(await service.enable(pluginParam(c.req.param("pluginId"))));
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.post("/plugins/:pluginId/disable", async (c) => {
    try {
      return c.json(await service.disable(pluginParam(c.req.param("pluginId"))));
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.delete("/plugins/:pluginId", async (c) => {
    const query = uninstallQuerySchema.safeParse({
      purgeStorage: c.req.query("purgeStorage") ?? c.req.query("purge"),
    });
    const body = uninstallBodySchema.safeParse(await readJson(c.req.raw));
    const purgeStorage =
      (query.success && query.data.purgeStorage) ||
      (body.success && body.data.purgeStorage === true);
    try {
      await service.uninstall(pluginParam(c.req.param("pluginId")), { purgeStorage });
      return c.json({ ok: true });
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.get("/plugins/:pluginId/config", async (c) => {
    try {
      return c.json(await service.getConfig(pluginParam(c.req.param("pluginId"))));
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.put("/plugins/:pluginId/config", async (c) => {
    const body = await readJson(c.req.raw);
    if (body === null) {
      return c.json({ error: "Invalid request" }, 400);
    }
    try {
      return c.json(await service.putConfig(pluginParam(c.req.param("pluginId")), body));
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.post("/plugins/:pluginId/health", async (c) => {
    try {
      return c.json(await service.checkHealth(pluginParam(c.req.param("pluginId"))));
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.get("/plugins/:pluginId/instances", async (c) => {
    try {
      return c.json({
        instances: await service.listInstances(pluginParam(c.req.param("pluginId"))),
      });
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.post("/plugins/:pluginId/instances", async (c) => {
    const parsed = createInstanceBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }
    try {
      const instance = await service.createInstance(pluginParam(c.req.param("pluginId")), {
        displayName: parsed.data.displayName,
        enabled: parsed.data.enabled,
        config: parsed.data.config as Record<string, JsonValue> | undefined,
      });
      return c.json(instance, 201);
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.get("/plugins/:pluginId/instances/:instanceId", async (c) => {
    try {
      return c.json(
        await service.getInstance(
          pluginParam(c.req.param("pluginId")),
          instanceParam(c.req.param("instanceId")),
        ),
      );
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.patch("/plugins/:pluginId/instances/:instanceId", async (c) => {
    const parsed = updateInstanceBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }
    try {
      return c.json(
        await service.updateInstance(
          pluginParam(c.req.param("pluginId")),
          instanceParam(c.req.param("instanceId")),
          parsed.data,
        ),
      );
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.post("/plugins/:pluginId/instances/:instanceId/enable", async (c) => {
    try {
      return c.json(
        await service.setInstanceEnabled(
          pluginParam(c.req.param("pluginId")),
          instanceParam(c.req.param("instanceId")),
          true,
        ),
      );
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.post("/plugins/:pluginId/instances/:instanceId/disable", async (c) => {
    try {
      return c.json(
        await service.setInstanceEnabled(
          pluginParam(c.req.param("pluginId")),
          instanceParam(c.req.param("instanceId")),
          false,
        ),
      );
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.delete("/plugins/:pluginId/instances/:instanceId", async (c) => {
    try {
      await service.deleteInstance(
        pluginParam(c.req.param("pluginId")),
        instanceParam(c.req.param("instanceId")),
      );
      return c.json({ ok: true });
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.get("/plugins/:pluginId/instances/:instanceId/config", async (c) => {
    try {
      return c.json(
        await service.getInstanceConfig(
          pluginParam(c.req.param("pluginId")),
          instanceParam(c.req.param("instanceId")),
        ),
      );
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.put("/plugins/:pluginId/instances/:instanceId/config", async (c) => {
    const body = await readJson(c.req.raw);
    if (body === null) {
      return c.json({ error: "Invalid request" }, 400);
    }
    try {
      return c.json(
        await service.putInstanceConfig(
          pluginParam(c.req.param("pluginId")),
          instanceParam(c.req.param("instanceId")),
          body,
        ),
      );
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.post("/plugins/:pluginId/instances/:instanceId/health", async (c) => {
    try {
      return c.json(
        await service.checkHealth(
          pluginParam(c.req.param("pluginId")),
          instanceParam(c.req.param("instanceId")),
        ),
      );
    } catch (error) {
      const mapped = handleForgeError(error);
      if (mapped) {
        return c.json(mapped.body, mapped.status as never);
      }
      throw error;
    }
  });

  routes.onError((error, c) => {
    if (error instanceof ForgeValidationError || error instanceof ForgeError) {
      return c.json(forgeErrorBody(error), error.status as never);
    }
    throw error;
  });

  return routes;
}

export { createAdminPluginService } from "../forge/admin-plugins.js";
export type {
  AdminPluginCompatibility,
  AdminPluginConfigView,
  AdminPluginContextFactory,
  AdminPluginManager,
  AdminPluginService,
  AdminPluginServiceOptions,
  AdminPluginView,
} from "../forge/admin-plugins.js";
