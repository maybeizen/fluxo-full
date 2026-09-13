import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { getApiUrl } from "@/lib/api";
import {
  AuthApiError,
  authErrorBodySchema,
  authMeResponseSchema,
  authPasskeysResponseSchema,
  authSessionsResponseSchema,
  loginResponseSchema,
  mfaEnableSchema,
  mfaRequiredCode,
  mfaSetupSchema,
  okTokenSchema,
  registerResponseSchema,
  stepUpChallengeSchema,
  userEnvelopeSchema,
  type AuthPasskey,
  type AuthSession,
  type AuthSessionInfo,
  type LoginResponse,
  type MfaEnableResult,
  type MfaSetup,
  type OkTokenResponse,
  type PublicUser,
  type RegisterResponse,
  type StepUpChallenge,
} from "@/lib/auth";
import { unwrapWebAuthnOptions } from "@/lib/webauthn";

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
    parsed.data.message ?? parsed.data.error ?? fallback,
    status,
    parsed.data.code,
  );
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
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

export async function fetchAuthMe(): Promise<AuthSession> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return { status: "unauthenticated" };
  }

  try {
    const response = await authFetch("/auth/me");
    const body = await readJson(response);

    if (response.status === 401) {
      const parsed = authErrorBodySchema.safeParse(body);
      if (parsed.success && parsed.data.code === mfaRequiredCode) {
        return { status: "mfa_required" };
      }
      return { status: "unauthenticated" };
    }

    if (!response.ok) {
      return { status: "unauthenticated" };
    }

    const parsed = authMeResponseSchema.safeParse(body);
    if (!parsed.success) {
      return { status: "unauthenticated" };
    }

    return { status: "authenticated", user: parsed.data.user };
  } catch {
    return { status: "unauthenticated" };
  }
}

export async function getAuthSession(): Promise<AuthSession> {
  return fetchAuthMe();
}

export async function login(input: {
  username: string;
  password: string;
  rememberMe: boolean;
  captchaToken?: string;
}): Promise<LoginResponse> {
  const response = await authFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => loginResponseSchema.parse(body),
    "Unable to sign in.",
  );
}

export async function register(input: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  captchaToken?: string;
}): Promise<RegisterResponse> {
  const response = await authFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => registerResponseSchema.parse(body),
    "Unable to create your account.",
  );
}

export async function verifyMfa(input: { code: string }): Promise<LoginResponse> {
  const response = await authFetch("/auth/mfa", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => loginResponseSchema.parse(body),
    "Unable to verify the code.",
  );
}

export async function logout(): Promise<void> {
  const response = await authFetch("/auth/logout", {
    method: "POST",
  });
  if (!response.ok && response.status !== 401) {
    const body = await readJson(response);
    throw errorFromBody(body, response.status, "Unable to sign out.");
  }
}

export async function forgotPassword(input: { email: string; captchaToken?: string }): Promise<void> {
  const response = await authFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await readJson(response);
    throw errorFromBody(body, response.status, "Unable to send a reset link.");
  }
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<void> {
  const response = await authFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await readJson(response);
    throw errorFromBody(body, response.status, "Unable to update your password.");
  }
}

export async function confirmEmail(input: { token: string }): Promise<void> {
  const response = await authFetch("/auth/confirm-email", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await readJson(response);
    throw errorFromBody(body, response.status, "Unable to confirm your email.");
  }
}

async function parseUser(response: Response, fallback: string): Promise<PublicUser> {
  return parseSuccess(response, (body) => userEnvelopeSchema.parse(body).user, fallback);
}

async function parseEmpty(response: Response, fallback: string): Promise<void> {
  if (!response.ok) {
    const body = await readJson(response);
    throw errorFromBody(body, response.status, fallback);
  }
}

export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  company: string | null;
}): Promise<PublicUser> {
  const response = await authFetch("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseUser(response, "Unable to update your profile.");
}

export async function uploadAvatar(file: File): Promise<PublicUser> {
  const body = new FormData();
  body.append("file", file);
  const response = await authFetch("/auth/avatar/upload", {
    method: "POST",
    body,
  });
  return parseUser(response, "Unable to upload your photo.");
}

export async function applyGravatarAvatar(): Promise<PublicUser> {
  const response = await authFetch("/auth/avatar/gravatar", {
    method: "POST",
  });
  return parseUser(response, "Unable to apply Gravatar.");
}

export async function deleteAvatar(): Promise<PublicUser> {
  const response = await authFetch("/auth/avatar", {
    method: "DELETE",
  });
  return parseUser(response, "Unable to remove your photo.");
}

export async function changeEmail(input: {
  email: string;
  challengeId?: string;
}): Promise<OkTokenResponse> {
  const response = await authFetch("/auth/email/change", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => okTokenSchema.parse(body),
    "Unable to change your email.",
  );
}

export async function changePassword(input: {
  currentPassword?: string;
  token?: string;
  newPassword: string;
  challengeId?: string;
}): Promise<PublicUser> {
  const response = await authFetch("/auth/password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseUser(response, "Unable to update your password.");
}

export async function requestPasswordEmailChallenge(): Promise<OkTokenResponse> {
  const response = await authFetch("/auth/password/email-challenge", {
    method: "POST",
  });
  return parseSuccess(
    response,
    (body) => okTokenSchema.parse(body),
    "Unable to send a confirmation email.",
  );
}

export async function stepUpTotp(input: { code: string }): Promise<StepUpChallenge> {
  const response = await authFetch("/auth/step-up/totp", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => stepUpChallengeSchema.parse(body),
    "Unable to verify the authenticator code.",
  );
}

export async function getStepUpPasskeyOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const response = await authFetch("/auth/step-up/passkey/options", {
    method: "POST",
  });
  return parseSuccess(
    response,
    (body) => unwrapWebAuthnOptions<PublicKeyCredentialRequestOptionsJSON>(body),
    "Unable to start passkey verification.",
  );
}

export async function verifyStepUpPasskey(
  input: AuthenticationResponseJSON,
): Promise<StepUpChallenge> {
  const response = await authFetch("/auth/step-up/passkey/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => stepUpChallengeSchema.parse(body),
    "Unable to verify the passkey.",
  );
}

export async function setupMfa(): Promise<MfaSetup> {
  const response = await authFetch("/auth/mfa/setup", {
    method: "POST",
  });
  return parseSuccess(response, (body) => mfaSetupSchema.parse(body), "Unable to start MFA setup.");
}

export async function enableMfa(input: { code: string }): Promise<MfaEnableResult> {
  const response = await authFetch("/auth/mfa/enable", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => mfaEnableSchema.parse(body),
    "Unable to enable two-factor authentication.",
  );
}

export async function disableMfa(input: { challengeId: string }): Promise<PublicUser> {
  const response = await authFetch("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseUser(response, "Unable to disable two-factor authentication.");
}

export async function getPasskeyRegisterOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const response = await authFetch("/auth/passkeys/register/options", {
    method: "POST",
  });
  return parseSuccess(
    response,
    (body) => unwrapWebAuthnOptions<PublicKeyCredentialCreationOptionsJSON>(body),
    "Unable to start passkey registration.",
  );
}

export async function verifyPasskeyRegistration(
  input: RegistrationResponseJSON & { name?: string },
): Promise<void> {
  const response = await authFetch("/auth/passkeys/register/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
  await parseEmpty(response, "Unable to add the passkey.");
}

export async function listPasskeys(): Promise<AuthPasskey[]> {
  const response = await authFetch("/auth/passkeys");
  return parseSuccess(
    response,
    (body) => authPasskeysResponseSchema.parse(body).passkeys,
    "Unable to load passkeys.",
  );
}

export async function deletePasskey(id: string, challengeId?: string): Promise<void> {
  const query = challengeId ? `?challengeId=${encodeURIComponent(challengeId)}` : "";
  const response = await authFetch(`/auth/passkeys/${encodeURIComponent(id)}${query}`, {
    method: "DELETE",
  });
  await parseEmpty(response, "Unable to remove the passkey.");
}

export async function getPasskeyLoginOptions(
  username?: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const response = await authFetch("/auth/passkeys/login/options", {
    method: "POST",
    body: JSON.stringify(username ? { username } : {}),
  });
  return parseSuccess(
    response,
    (body) => unwrapWebAuthnOptions<PublicKeyCredentialRequestOptionsJSON>(body),
    "Unable to start passkey sign-in.",
  );
}

export async function verifyPasskeyLogin(
  input: AuthenticationResponseJSON,
): Promise<LoginResponse> {
  const response = await authFetch("/auth/passkeys/login/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseSuccess(
    response,
    (body) => loginResponseSchema.parse(body),
    "Unable to sign in with a passkey.",
  );
}

export async function listSessions(): Promise<AuthSessionInfo[]> {
  const response = await authFetch("/auth/sessions");
  return parseSuccess(
    response,
    (body) => authSessionsResponseSchema.parse(body).sessions,
    "Unable to load sessions.",
  );
}

export async function revokeSession(id: string): Promise<void> {
  const response = await authFetch(`/auth/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseEmpty(response, "Unable to revoke the session.");
}

export async function revokeOtherSessions(): Promise<void> {
  const response = await authFetch("/auth/sessions", {
    method: "DELETE",
  });
  await parseEmpty(response, "Unable to revoke other sessions.");
}
