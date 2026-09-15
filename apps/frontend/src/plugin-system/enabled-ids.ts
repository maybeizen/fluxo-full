import { isPluginId } from "@fluxo/forge";
import { z } from "zod";
import { getApiUrl } from "@/lib/api";

const publicPanelPluginIdsSchema = z.object({
  pluginIds: z.array(z.string()),
});

const adminPluginListSchema = z.object({
  plugins: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

function panelPluginIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => isPluginId(id)))].sort();
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  return JSON.parse(text) as unknown;
}

export async function fetchPublicEnabledPanelPluginIds(): Promise<
  string[] | undefined
> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return undefined;
  }
  try {
    const response = await fetch(`${apiUrl}/plugins/panel`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = publicPanelPluginIdsSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      return undefined;
    }
    return panelPluginIds(parsed.data.pluginIds);
  } catch {
    return undefined;
  }
}

export async function fetchAdminEnabledPanelPluginIds(): Promise<
  string[] | undefined
> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return undefined;
  }
  try {
    const response = await fetch(`${apiUrl}/admin/plugins`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = adminPluginListSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      return undefined;
    }
    return panelPluginIds(
      parsed.data.plugins
        .filter((plugin) => plugin.type === "panel" && plugin.enabled)
        .map((plugin) => plugin.id),
    );
  } catch {
    return undefined;
  }
}
