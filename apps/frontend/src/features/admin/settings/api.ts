import type { AppSettingsAdminResponse, AppSettingsPatch } from "@fluxo/types";
import { getApiUrl } from "@/lib/api";
import { AuthApiError, authErrorBodySchema } from "@/lib/auth";
import { adminSettingsResponseSchema } from "./schemas";

export const adminSettingsQueryKey = ["admin", "settings"] as const;

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  return JSON.parse(text) as unknown;
}

function errorFromBody(body: unknown, status: number, fallback: string): AuthApiError {
  const parsed = authErrorBodySchema.safeParse(body);
  if (!parsed.success) {
    return new AuthApiError(fallback, status);
  }
  return new AuthApiError(
    parsed.data.message ?? parsed.data.error ?? parsed.data.code ?? fallback,
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
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (init?.body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
}

async function parseSuccess(
  response: Response,
  fallback: string,
): Promise<AppSettingsAdminResponse> {
  const body = await readJson(response);
  if (!response.ok) {
    throw errorFromBody(body, response.status, fallback);
  }
  return adminSettingsResponseSchema.parse(body);
}

export async function getAdminSettings(): Promise<AppSettingsAdminResponse> {
  const response = await adminFetch("/admin/settings");
  return parseSuccess(response, "Unable to load settings.");
}

export async function patchAdminSettings(
  input: AppSettingsPatch,
): Promise<AppSettingsAdminResponse> {
  const response = await adminFetch("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseSuccess(response, "Unable to save settings.");
}

export async function uploadAppIcon(file: File): Promise<AppSettingsAdminResponse> {
  const body = new FormData();
  body.set("file", file);
  const response = await adminFetch("/admin/settings/icon", {
    method: "POST",
    body,
  });
  return parseSuccess(response, "Unable to upload the app icon.");
}

export async function deleteAppIcon(): Promise<AppSettingsAdminResponse> {
  const response = await adminFetch("/admin/settings/icon", { method: "DELETE" });
  return parseSuccess(response, "Unable to remove the app icon.");
}
