import { getApiUrl } from "@/lib/api";
import { AuthApiError, authErrorBodySchema } from "@/lib/auth";
import {
  adminOkSchema,
  adminPluginConfigViewSchema,
  adminPluginDetailSchema,
  adminPluginHealthSchema,
  adminPluginInstanceSchema,
  adminPluginInstancesResponseSchema,
  adminPluginListResponseSchema,
  type ConfigPayload,
} from "./schemas";
import type {
  AdminPluginConfigView,
  AdminPluginDetail,
  AdminPluginListItem,
  PluginHealthSnapshot,
  PluginInstanceRecord,
} from "./types";

export const adminPluginsQueryKey = ["admin", "plugins"] as const;

export function adminPluginQueryKey(id: string) {
  return ["admin", "plugins", id] as const;
}

export function adminPluginConfigQueryKey(id: string) {
  return ["admin", "plugins", id, "config"] as const;
}

export function adminPluginInstancesQueryKey(id: string) {
  return ["admin", "plugins", id, "instances"] as const;
}

export function adminPluginInstanceConfigQueryKey(
  pluginId: string,
  instanceId: string,
) {
  return [
    "admin",
    "plugins",
    pluginId,
    "instances",
    instanceId,
    "config",
  ] as const;
}

function pluginRoot(id: string): string {
  return `/admin/plugins/${encodeURIComponent(id)}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  return JSON.parse(text) as unknown;
}

function errorFromBody(
  body: unknown,
  status: number,
  fallback: string,
): AuthApiError {
  const parsed = authErrorBodySchema.safeParse(body);
  if (!parsed.success) {
    return new AuthApiError(fallback, status);
  }
  return new AuthApiError(
    parsed.data.message ?? parsed.data.error ?? fallback,
    status,
    parsed.data.code,
  );
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new AuthApiError("VITE_PUBLIC_API_URL is not set", 0);
  }
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
}

async function parseSuccess<T>(
  response: Response,
  parse: (body: unknown) => T,
  fallback: string,
): Promise<T> {
  const body = await readJson(response);
  if (!response.ok) {
    throw errorFromBody(body, response.status, fallback);
  }
  return parse(body);
}

export async function listAdminPlugins(): Promise<AdminPluginListItem[]> {
  const response = await adminFetch("/admin/plugins");
  const parsed = await parseSuccess(
    response,
    (body) => adminPluginListResponseSchema.parse(body),
    "Unable to load plugins.",
  );
  return parsed.plugins;
}

export async function getAdminPlugin(id: string): Promise<AdminPluginDetail> {
  const response = await adminFetch(pluginRoot(id));
  return parseSuccess(
    response,
    (body) => adminPluginDetailSchema.parse(body),
    "Unable to load this plugin.",
  );
}

export async function enableAdminPlugin(
  id: string,
): Promise<AdminPluginDetail> {
  const response = await adminFetch(`${pluginRoot(id)}/enable`, {
    method: "POST",
  });
  return parseSuccess(
    response,
    (body) => adminPluginDetailSchema.parse(body),
    "Unable to enable this plugin.",
  );
}

export async function disableAdminPlugin(
  id: string,
): Promise<AdminPluginDetail> {
  const response = await adminFetch(`${pluginRoot(id)}/disable`, {
    method: "POST",
  });
  return parseSuccess(
    response,
    (body) => adminPluginDetailSchema.parse(body),
    "Unable to disable this plugin.",
  );
}

export async function uninstallAdminPlugin(
  id: string,
  options?: { purgeStorage?: boolean },
): Promise<void> {
  const query = options?.purgeStorage === true ? "?purgeStorage=true" : "";
  const response = await adminFetch(`${pluginRoot(id)}${query}`, {
    method: "DELETE",
  });
  await parseSuccess(
    response,
    (body) => adminOkSchema.parse(body),
    "Unable to uninstall this plugin.",
  );
}

export async function getAdminPluginConfig(
  id: string,
): Promise<AdminPluginConfigView> {
  const response = await adminFetch(`${pluginRoot(id)}/config`);
  return parseSuccess(
    response,
    (body) => adminPluginConfigViewSchema.parse(body),
    "Unable to load plugin configuration.",
  );
}

export async function putAdminPluginConfig(
  id: string,
  payload: ConfigPayload,
): Promise<AdminPluginConfigView> {
  const response = await adminFetch(`${pluginRoot(id)}/config`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return parseSuccess(
    response,
    (body) => adminPluginConfigViewSchema.parse(body),
    "Unable to save configuration.",
  );
}

export async function checkAdminPluginHealth(
  id: string,
): Promise<PluginHealthSnapshot> {
  const response = await adminFetch(`${pluginRoot(id)}/health`, {
    method: "POST",
  });
  return parseSuccess(
    response,
    (body) => adminPluginHealthSchema.parse(body),
    "Unable to check plugin health.",
  );
}

export async function listAdminPluginInstances(
  id: string,
): Promise<PluginInstanceRecord[]> {
  const response = await adminFetch(`${pluginRoot(id)}/instances`);
  const parsed = await parseSuccess(
    response,
    (body) => adminPluginInstancesResponseSchema.parse(body),
    "Unable to load plugin instances.",
  );
  return parsed.instances;
}

export async function createAdminPluginInstance(
  id: string,
  input: { displayName: string; enabled?: boolean },
): Promise<PluginInstanceRecord> {
  const response = await adminFetch(`${pluginRoot(id)}/instances`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => adminPluginInstanceSchema.parse(body),
    "Unable to create this instance.",
  );
}

export async function setAdminPluginInstanceEnabled(
  pluginId: string,
  instanceId: string,
  enabled: boolean,
): Promise<PluginInstanceRecord> {
  const action = enabled ? "enable" : "disable";
  const response = await adminFetch(
    `${pluginRoot(pluginId)}/instances/${encodeURIComponent(instanceId)}/${action}`,
    { method: "POST" },
  );
  return parseSuccess(
    response,
    (body) => adminPluginInstanceSchema.parse(body),
    "Unable to update this instance.",
  );
}

export async function deleteAdminPluginInstance(
  pluginId: string,
  instanceId: string,
): Promise<void> {
  const response = await adminFetch(
    `${pluginRoot(pluginId)}/instances/${encodeURIComponent(instanceId)}`,
    { method: "DELETE" },
  );
  await parseSuccess(
    response,
    (body) => adminOkSchema.parse(body),
    "Unable to delete this instance.",
  );
}

export async function getAdminPluginInstanceConfig(
  pluginId: string,
  instanceId: string,
): Promise<AdminPluginConfigView> {
  const response = await adminFetch(
    `${pluginRoot(pluginId)}/instances/${encodeURIComponent(instanceId)}/config`,
  );
  return parseSuccess(
    response,
    (body) => adminPluginConfigViewSchema.parse(body),
    "Unable to load instance configuration.",
  );
}

export async function putAdminPluginInstanceConfig(
  pluginId: string,
  instanceId: string,
  payload: ConfigPayload,
): Promise<AdminPluginConfigView> {
  const response = await adminFetch(
    `${pluginRoot(pluginId)}/instances/${encodeURIComponent(instanceId)}/config`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return parseSuccess(
    response,
    (body) => adminPluginConfigViewSchema.parse(body),
    "Unable to save configuration.",
  );
}

export async function checkAdminPluginInstanceHealth(
  pluginId: string,
  instanceId: string,
): Promise<PluginHealthSnapshot> {
  const response = await adminFetch(
    `${pluginRoot(pluginId)}/instances/${encodeURIComponent(instanceId)}/health`,
    { method: "POST" },
  );
  return parseSuccess(
    response,
    (body) => adminPluginHealthSchema.parse(body),
    "Unable to check plugin health.",
  );
}
