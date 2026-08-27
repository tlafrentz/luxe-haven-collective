"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

declare global {
  interface Window { turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (widgetId?: string) => void } }
}

export function TurnstileChallenge({ attemptKey = "initial" }: Readonly<{ attemptKey?: string }>) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [token, setToken] = useState("");
  const id = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("public-auth-captcha", { detail: false }));
  }, [attemptKey]);
  const render = () => {
    if (!siteKey || !window.turnstile || !container.current || widget.current) return;
    const update = (value: string) => { setToken(value); window.dispatchEvent(new CustomEvent("public-auth-captcha", { detail: Boolean(value) })); };
    widget.current = window.turnstile.render(container.current, { sitekey: siteKey, callback: (value: string) => update(value), "expired-callback": () => update(""), "error-callback": () => update(""), "response-field": false });
  };
  if (!siteKey) return <p role="alert" className="text-sm text-amber-800">Authentication requests are temporarily unavailable.</p>;
  return <div className="space-y-2" data-attempt={attemptKey}>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} onReady={render} />
    <div id={`turnstile-${id}`} ref={container} />
    <input type="hidden" name="captchaToken" value={token} />
    <p className="text-xs text-stone-600" aria-live="polite">{token ? "Security check complete." : "Complete the security check to continue."}</p>
  </div>;
}

export function PublicAuthSubmitButton({ children }: Readonly<{ children: string }>) {
  const { pending } = useFormStatus();
  const [captchaReady, setCaptchaReady] = useState(false);
  useEffect(() => {
    const listener = (event: Event) => setCaptchaReady(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("public-auth-captcha", listener);
    return () => window.removeEventListener("public-auth-captcha", listener);
  }, []);
  return <button disabled={pending || !captchaReady} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Submitting..." : children}</button>;
}
