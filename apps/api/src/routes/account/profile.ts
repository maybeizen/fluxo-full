import type { Hono } from "hono";
import type { AppBindings } from "../../app-bindings.js";
import { avatarPublicUrl, avatarStorageKey, isAvatarFile } from "../../auth/avatar.js";
import { gravatarUrl } from "../../auth/gravatar.js";
import { profileBodySchema } from "../../auth/schemas.js";
import type { AuthRouteOptions } from "./shared.js";
import { toPublicAccount } from "./shared.js";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function registerProfileRoutes(routes: Hono<AppBindings>, options: AuthRouteOptions): void {
  routes.patch("/profile", async (c) => {
    const parsed = profileBodySchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const account = c.get("account");
    const updated = await options.users.update(account.id, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      dateOfBirth: parsed.data.dateOfBirth,
      company: parsed.data.company,
    });
    if (!updated) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ user: await toPublicAccount(options, updated) });
  });

  routes.post("/avatar/upload", async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File) || !isAvatarFile(file)) {
      return c.json({ error: "Invalid image" }, 400);
    }

    const account = c.get("account");
    const key = avatarStorageKey(account.id);
    const bytes = Buffer.from(await file.arrayBuffer());
    await options.storage.put(key, bytes, file.type);
    const avatarUrl = avatarPublicUrl(options.config, key);
    const updated = await options.users.update(account.id, {
      avatarUrl,
      avatarSource: "upload",
    });
    if (!updated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.json({ user: await toPublicAccount(options, updated) });
  });

  routes.post("/avatar/gravatar", async (c) => {
    const account = c.get("account");
    const updated = await options.users.update(account.id, {
      avatarUrl: gravatarUrl(account.email),
      avatarSource: "gravatar",
    });
    if (!updated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.json({ user: await toPublicAccount(options, updated) });
  });

  routes.delete("/avatar", async (c) => {
    const account = c.get("account");
    if (account.avatarSource === "upload") {
      await options.storage.delete(avatarStorageKey(account.id));
    }
    const updated = await options.users.update(account.id, {
      avatarUrl: null,
      avatarSource: "none",
    });
    if (!updated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.json({ user: await toPublicAccount(options, updated) });
  });
}
