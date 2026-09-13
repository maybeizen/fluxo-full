import type { CaptchaType } from "@fluxo/types";

export interface CaptchaVerifyInput {
  type: CaptchaType;
  secret: string;
  token: string;
}

export type CaptchaVerifier = (input: CaptchaVerifyInput) => Promise<boolean>;

const endpoints: Record<Exclude<CaptchaType, "none">, string> = {
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
  hcaptcha: "https://hcaptcha.com/siteverify",
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
};

export function createCaptchaVerifier(fetchImpl: typeof fetch = fetch): CaptchaVerifier {
  return async (input) => {
    if (input.type === "none") {
      return true;
    }
    const body = new URLSearchParams({
      secret: input.secret,
      response: input.token,
    });
    const response = await fetchImpl(endpoints[input.type], {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      return false;
    }
    const parsed: unknown = await response.json();
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }
    return (parsed as { success?: unknown }).success === true;
  };
}
