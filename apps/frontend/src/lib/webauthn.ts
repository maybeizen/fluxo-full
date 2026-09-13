import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { AuthApiError } from "@/lib/auth";

export { startAuthentication, startRegistration };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function unwrapWebAuthnOptions<
  T extends PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON,
>(body: unknown): T {
  if (!isRecord(body)) {
    throw new AuthApiError("Invalid WebAuthn options.", 500);
  }
  if (isRecord(body.options)) {
    return body.options as T;
  }
  return body as T;
}
