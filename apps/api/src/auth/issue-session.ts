import type { ResolvedSession, SessionEngine } from "./session.js";

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    return first && first.length > 0 ? first : null;
  }
  return null;
}

export async function issueSession(
  sessions: SessionEngine,
  input: {
    session: ResolvedSession | null;
    userId: string;
    mfaVerified: boolean;
    rememberMe: boolean;
    request: Request;
  },
): Promise<string> {
  if (input.session) {
    await sessions.destroy(input.session.cookieValue);
  }

  return sessions.create({
    userId: input.userId,
    mfaVerified: input.mfaVerified,
    rememberMe: input.rememberMe,
    userAgent: input.request.headers.get("user-agent"),
    ip: clientIp(input.request.headers),
  });
}
