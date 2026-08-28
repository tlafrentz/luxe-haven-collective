"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
};

declare global { interface Window { turnstile?: TurnstileApi } }

type ChallengeStatus = "loading" | "ready" | "complete" | "error" | "expired";
const announceCaptcha = (ready: boolean) => window.dispatchEvent(new CustomEvent("public-auth-captcha", { detail: ready }));

export function TurnstileChallenge({ attemptKey = "initial" }: Readonly<{ attemptKey?: string }>) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<ChallengeStatus>("loading");
  const [scriptReady, setScriptReady] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const id = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const updateToken = useCallback((value: string) => {
    setToken(value);
    setStatus(value ? "complete" : "ready");
    announceCaptcha(Boolean(value));
  }, []);

  const renderChallenge = useCallback(() => {
    if (!siteKey || !window.turnstile || !container.current || widget.current) return;
    try {
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (value: string) => updateToken(value),
        "expired-callback": () => { setToken(""); setStatus("expired"); announceCaptcha(false); },
        "error-callback": () => { setToken(""); setStatus("error"); announceCaptcha(false); },
        "response-field": false,
      });
      setStatus("ready");
    } catch {
      setStatus("error");
      announceCaptcha(false);
    }
  }, [siteKey, updateToken]);

  useEffect(() => {
    announceCaptcha(false);
  }, [attemptKey]);

  useEffect(() => {
    if (!scriptReady && !window.turnstile) return;
    const timer = window.setTimeout(renderChallenge, 0);
    return () => window.clearTimeout(timer);
  }, [renderAttempt, renderChallenge, scriptReady]);

  useEffect(() => () => {
    if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
    widget.current = undefined;
    announceCaptcha(false);
  }, []);

  const retry = () => {
    if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
    widget.current = undefined;
    container.current?.replaceChildren();
    setToken("");
    setStatus("loading");
    setShowTroubleshooting(false);
    announceCaptcha(false);
    setScriptReady(Boolean(window.turnstile));
    setRenderAttempt((value) => value + 1);
  };

  if (!siteKey) return <div role="alert" className="space-y-2 text-sm text-amber-800"><p>Authentication requests are temporarily unavailable.</p><p>Please try again later or contact support if access is urgent.</p></div>;

  const failed = status === "error" || status === "expired";
  const statusMessage = status === "complete" ? "Security check complete." : status === "error" ? "The security check could not load or complete." : status === "expired" ? "The security check expired. Complete a new check to continue." : "Complete the security check to continue.";

  return <div className="space-y-2" data-attempt={attemptKey}>
    <Script id="cloudflare-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setScriptReady(true)} onReady={() => setScriptReady(true)} onError={() => { setStatus("error"); announceCaptcha(false); }} />
    <div id={`turnstile-${id}`} ref={container} aria-label="Security check" />
    <input type="hidden" name="captchaToken" value={token} />
    <p className={failed ? "text-sm text-red-700" : "text-xs text-stone-600"} aria-live="polite">{statusMessage}</p>
    {failed ? <button type="button" onClick={retry} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold">Retry security check</button> : null}
    <button type="button" aria-expanded={showTroubleshooting} aria-controls={`turnstile-help-${id}`} onClick={() => setShowTroubleshooting((value) => !value)} className="block text-sm text-stone-600 underline underline-offset-4">Troubleshoot security check</button>
    {showTroubleshooting ? <div id={`turnstile-help-${id}`} role="status" className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700"><p>Make sure JavaScript and cookies are enabled, then retry the security check. Privacy or network filters may block Cloudflare challenges.</p><button type="button" onClick={retry} className="mt-3 font-semibold underline underline-offset-4">Reload the security check</button></div> : null}
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
