import { getApiUrl } from "@/lib/api";
import { AuthApiError, authErrorBodySchema } from "@/lib/auth";
import {
  adminDeleteResponseSchema,
  adminUserDetailSchema,
  adminUserListResponseSchema,
  cannotDeleteLastAdminCode,
  cannotDeleteSelfCode,
  cannotDemoteLastAdminCode,
  cannotDemoteSelfCode,
  cannotSuspendSelfCode,
} from "./schemas";
import type { AdminCreateUserInput, AdminPatchUserInput, AdminUserDetail, AdminUserListItem } from "./types";

const adminErrorMessages: Record<string, string> = {
  [cannotDeleteSelfCode]: "You cannot delete your own account.",
  [cannotDeleteLastAdminCode]: "You cannot delete the last administrator.",
  [cannotDemoteSelfCode]: "You cannot remove your own admin role.",
  [cannotDemoteLastAdminCode]: "You cannot demote the last administrator.",
  [cannotSuspendSelfCode]: "You cannot suspend your own account.",
};

export const adminUsersQueryKey = ["admin", "users"] as const;

export function adminUserQueryKey(id: string) {
  return ["admin", "users", id] as const;
}

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
  const code = parsed.data.code;
  return new AuthApiError(
    parsed.data.message ??
      parsed.data.error ??
      (code ? adminErrorMessages[code] : undefined) ??
      fallback,
    status,
    code,
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

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  const response = await adminFetch("/admin/users");
  const parsed = await parseSuccess(
    response,
    (body) => adminUserListResponseSchema.parse(body),
    "Unable to load users.",
  );
  return parsed.users;
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  const response = await adminFetch(`/admin/users/${id}`);
  return parseSuccess(
    response,
    (body) => adminUserDetailSchema.parse(body),
    "Unable to load this user.",
  );
}

export async function createAdminUser(input: AdminCreateUserInput): Promise<AdminUserDetail> {
  const response = await adminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => adminUserDetailSchema.parse(body),
    "Unable to create this user.",
  );
}

export async function patchAdminUser(
  id: string,
  input: AdminPatchUserInput,
): Promise<AdminUserDetail> {
  const response = await adminFetch(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => adminUserDetailSchema.parse(body),
    "Unable to update this user.",
  );
}

export async function deleteAdminUser(id: string): Promise<void> {
  const response = await adminFetch(`/admin/users/${id}`, {
    method: "DELETE",
  });
  await parseSuccess(
    response,
    (body) => adminDeleteResponseSchema.parse(body),
    "Unable to delete this user.",
  );
}
