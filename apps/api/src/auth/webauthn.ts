import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

export interface WebAuthnCredentialInput {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

export interface WebAuthnService {
  registrationOptions(input: {
    rpName: string;
    rpID: string;
    userID: Uint8Array;
    userName: string;
    userDisplayName: string;
    excludeCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[];
  }): Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistration(input: {
    response: RegistrationResponseJSON;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRPID: string;
  }): Promise<{
    verified: boolean;
    credential?: WebAuthnCredentialInput;
  }>;
  authenticationOptions(input: {
    rpID: string;
    allowCredentials?: { id: string; transports?: AuthenticatorTransportFuture[] }[];
  }): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyAuthentication(input: {
    response: AuthenticationResponseJSON;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRPID: string;
    credential: WebAuthnCredentialInput;
  }): Promise<{ verified: boolean; newCounter?: number }>;
}

export function createSimpleWebAuthnService(): WebAuthnService {
  return {
    async registrationOptions(input) {
      return generateRegistrationOptions({
        rpName: input.rpName,
        rpID: input.rpID,
        userID: new Uint8Array(input.userID),
        userName: input.userName,
        userDisplayName: input.userDisplayName,
        attestationType: "none",
        excludeCredentials: input.excludeCredentials,
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });
    },

    async verifyRegistration(input) {
      const verification = await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin: input.expectedOrigin,
        expectedRPID: input.expectedRPID,
        requireUserVerification: false,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return { verified: false };
      }
      const { credential } = verification.registrationInfo;
      return {
        verified: true,
        credential: {
          id: credential.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports,
        },
      };
    },

    async authenticationOptions(input) {
      return generateAuthenticationOptions({
        rpID: input.rpID,
        allowCredentials: input.allowCredentials,
        userVerification: "preferred",
      });
    },

    async verifyAuthentication(input) {
      const verification = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin: input.expectedOrigin,
        expectedRPID: input.expectedRPID,
        credential: {
          id: input.credential.id,
          publicKey: new Uint8Array(input.credential.publicKey),
          counter: input.credential.counter,
          transports: input.credential.transports,
        },
        requireUserVerification: false,
      });
      if (!verification.verified) {
        return { verified: false };
      }
      return {
        verified: true,
        newCounter: verification.authenticationInfo.newCounter,
      };
    },
  };
}

export function relyingParty(config: { frontendUrl: string; appName: string }): {
  rpID: string;
  origin: string;
  rpName: string;
} {
  return {
    rpID: new URL(config.frontendUrl).hostname,
    origin: config.frontendUrl,
    rpName: config.appName,
  };
}

export function decodePublicKey(stored: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(stored, "base64"));
}

export function encodePublicKey(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

export function parseTransports(value: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    return parsed.filter((entry): entry is AuthenticatorTransportFuture => typeof entry === "string");
  } catch {
    return undefined;
  }
}

export function serializeTransports(
  transports: AuthenticatorTransportFuture[] | undefined,
): string | null {
  if (!transports || transports.length === 0) {
    return null;
  }
  return JSON.stringify(transports);
}
