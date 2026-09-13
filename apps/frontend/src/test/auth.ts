import { vi } from "vitest";
import * as api from "@/lib/api";
import { UserRole, type PublicUser } from "@/lib/auth";

export function createUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: "user-1",
    username: "maya",
    email: "maya@fluxo.test",
    firstName: "Maya",
    lastName: "Izen",
    avatarUrl: null,
    avatarSource: "none",
    dateOfBirth: null,
    company: null,
    role: UserRole.User,
    emailVerified: true,
    mfaEnabled: false,
    hasPasskey: false,
    suspended: false,
    suspendedReason: null,
    createdAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

export function mockApiUrl(url = "http://api.test"): void {
  vi.mocked(api.getApiUrl).mockReturnValue(url);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
