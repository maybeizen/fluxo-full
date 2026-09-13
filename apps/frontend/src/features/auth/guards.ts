import { redirect } from "@tanstack/react-router";
import { getAuthSession } from "@/lib/auth-api";
import type { AuthSession } from "@/lib/auth";

export async function requireAuthenticatedSession(): Promise<
  Extract<AuthSession, { status: "authenticated" }>
> {
  const session = await getAuthSession();
  if (session.status === "mfa_required") {
    throw redirect({ to: "/mfa" });
  }
  if (session.status !== "authenticated") {
    throw redirect({ to: "/login" });
  }
  return session;
}
