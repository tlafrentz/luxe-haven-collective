"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startCheckoutAttempt } from "@/app/actions/direct-booking";
import { track } from "@/lib/analytics/track";

const RETRY_TIMEOUT_MS = 8_000;

function attemptStorageKey(propertySlug: string): string {
  return `lhs001:checkout-attempt:${propertySlug}`;
}

export function CheckoutHandoff({
  propertySlug,
  propertyName,
}: {
  propertySlug: string;
  propertyName: string;
}) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<"preparing" | "redirecting" | "unavailable" | "error">("preparing");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let existingAttemptToken: string | undefined;
    try {
      existingAttemptToken = sessionStorage.getItem(attemptStorageKey(propertySlug)) ?? undefined;
    } catch {
      existingAttemptToken = undefined;
    }

    const timeout = setTimeout(() => {
      setState((current) => (current === "preparing" ? "error" : current));
    }, RETRY_TIMEOUT_MS);

    track("stay_checkout_launched", { propertySlug });

    startCheckoutAttempt({
      propertySlug,
      existingAttemptToken,
      utmSource: searchParams.get("utm_source") ?? undefined,
      utmMedium: searchParams.get("utm_medium") ?? undefined,
      utmCampaign: searchParams.get("utm_campaign") ?? undefined,
      referralId: searchParams.get("ref") ?? undefined,
    })
      .then((result) => {
        clearTimeout(timeout);
        if (!result.ok) {
          setState("error");
          return;
        }
        try {
          sessionStorage.setItem(attemptStorageKey(propertySlug), result.attemptToken);
        } catch {
          // Best-effort only — a lost idempotency key just means a repeated
          // click starts a fresh attempt instead of reusing one.
        }
        if (!result.redirectUrl) {
          setState("unavailable");
          return;
        }
        setState("redirecting");
        window.location.assign(result.redirectUrl);
      })
      .catch(() => {
        clearTimeout(timeout);
        setState("error");
      });

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertySlug]);

  return (
    <main className="bg-[#fffdf9] py-20">
      <div className="container-shell max-w-lg text-center">
        {state === "preparing" || state === "redirecting" ? (
          <div role="status" aria-live="polite">
            <div
              aria-hidden="true"
              className="mx-auto size-14 animate-spin rounded-full border-4 border-[#dfe9e2] border-t-[#102825]"
            />
            <h1 className="mt-6 font-serif text-3xl">
              Preparing your secure checkout
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              We&apos;re confirming your dates for {propertyName} and opening
              our booking partner&apos;s secure checkout. Please keep this
              window open.
            </p>
          </div>
        ) : state === "unavailable" ? (
          <div role="status" aria-live="polite">
            <h1 className="font-serif text-3xl">Checkout isn&apos;t connected yet</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Direct booking for {propertyName} isn&apos;t live yet. Your
              dates have not been reserved or held — nothing has been
              charged.
            </p>
            <a href="/contact?service=stay" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
              Contact us instead
            </a>
          </div>
        ) : (
          <div role="alert" aria-live="assertive">
            <h1 className="font-serif text-3xl">We couldn&apos;t open secure checkout</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Your dates have not been reserved or held, and nothing has been
              charged. Please try again, or contact us for help.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                Try again
              </button>
              <a href="/contact?service=stay" className="rounded-full border px-6 py-3 text-sm font-semibold">
                Contact support
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
