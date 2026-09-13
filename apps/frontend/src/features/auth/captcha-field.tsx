import { useEffect, useId, useRef } from "react";
import type { CaptchaType } from "@fluxo/types";
import { useT, useUI } from "@/theme-system";

const scripts: Record<Exclude<CaptchaType, "none">, string> = {
  recaptcha: "https://www.google.com/recaptcha/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
};

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("captcha_script"));
    document.head.append(script);
  });
}

export function CaptchaField({
  type,
  siteKey,
  onToken,
}: {
  type: CaptchaType;
  siteKey: string | null;
  onToken: (token: string) => void;
}) {
  const { Field, FieldLabel, Input } = useUI();
  const t = useT();
  const hostId = useId().replace(/:/g, "");
  const tokenInputId = `${hostId}-token`;
  const rendered = useRef(false);

  useEffect(() => {
    if (type === "none" || !siteKey) {
      return;
    }
    let cancelled = false;
    rendered.current = false;
    void loadScript(scripts[type])
      .then(() => {
        if (cancelled || rendered.current) {
          return;
        }
        const host = document.getElementById(hostId);
        if (!host) {
          return;
        }
        const api =
          type === "recaptcha"
            ? (window as unknown as { grecaptcha?: { render: (el: HTMLElement, opts: object) => void } })
                .grecaptcha
            : type === "hcaptcha"
              ? (window as unknown as { hcaptcha?: { render: (el: string, opts: object) => void } })
                  .hcaptcha
              : (window as unknown as { turnstile?: { render: (el: string, opts: object) => void } })
                  .turnstile;
        if (!api) {
          return;
        }
        rendered.current = true;
        const callback = (token: string) => onToken(token);
        if (type === "recaptcha") {
          (api as { render: (el: HTMLElement, opts: object) => void }).render(host, {
            sitekey: siteKey,
            callback,
          });
          return;
        }
        (api as { render: (el: string, opts: object) => void }).render(hostId, {
          sitekey: siteKey,
          callback,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hostId, onToken, siteKey, type]);

  if (type === "none" || !siteKey) {
    return null;
  }

  return (
    <Field>
      <FieldLabel htmlFor={tokenInputId}>{t("auth.captcha.label")}</FieldLabel>
      <div id={hostId} className="min-h-16" />
      <Input
        id={tokenInputId}
        name="captchaToken"
        className="sr-only"
        aria-label={t("auth.captcha.label")}
        onChange={(event) => onToken(event.target.value)}
      />
    </Field>
  );
}
