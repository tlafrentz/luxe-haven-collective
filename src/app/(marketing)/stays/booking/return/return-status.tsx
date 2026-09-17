"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { verifyCheckoutAttempt, type CheckoutAttemptVerification } from "@/app/actions/direct-booking";
import { track } from "@/lib/analytics/track";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 15;

export function ReturnStatus({ attemptToken }: { attemptToken: string }) {
  const [result, setResult] = useState<CheckoutAttemptVerification | null>(() =>
    attemptToken ? null : { state: "not_found" },
  );
  const pollCountRef = useRef(0);
  const trackedConfirmedRef = useRef(false);

  useEffect(() => {
    if (!attemptToken) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const outcome = await verifyCheckoutAttempt(attemptToken);
      if (cancelled) return;
      setResult(outcome);

      if (outcome.state === "confirmed" && !trackedConfirmedRef.current) {
        trackedConfirmedRef.current = true;
        // Fires only after server-side verification against a Hospitable-
        // sourced projection — never from the client render alone (LHS-AN-003).
        track("stay_booking_verified", { confirmationCode: outcome.confirmationCode });
      }

      if (outcome.state === "pending" && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attemptToken]);

  if (!result) {
    return (
      <main className="bg-[#fffdf9] py-20">
        <div className="container-shell max-w-lg text-center" role="status" aria-live="polite">
          <div aria-hidden="true" className="mx-auto size-14 animate-spin rounded-full border-4 border-[#dfe9e2] border-t-[#102825]" />
          <p className="mt-6 text-sm text-stone-600">Checking your booking…</p>
        </div>
      </main>
    );
  }

  if (result.state === "not_found") {
    return (
      <main className="bg-[#fffdf9] py-20">
        <div className="container-shell max-w-lg text-center">
          <h1 className="font-serif text-3xl">We couldn&apos;t find that booking</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            This link may have expired or been used already. If you believe
            you completed a booking, contact us with your confirmation email.
          </p>
          <Link href="/contact?service=stay" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Contact support
          </Link>
        </div>
      </main>
    );
  }

  if (result.state === "pending") {
    return (
      <main className="bg-[#fffdf9] py-20">
        <div className="container-shell max-w-lg text-center" role="status" aria-live="polite">
          <div aria-hidden="true" className="mx-auto size-14 animate-spin rounded-full border-4 border-[#dfe9e2] border-t-[#102825]" />
          <h1 className="mt-6 font-serif text-3xl">Confirming your booking</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Your payment was received and we&apos;re verifying your
            reservation with our booking partner. This can take a few
            minutes — you don&apos;t need to stay on this page. A
            confirmation will also be sent by email.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#fffdf9] py-20">
      <div className="container-shell max-w-lg text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800">
          ✓
        </div>
        <h1 className="mt-6 font-serif text-3xl">Your stay is confirmed</h1>
        <div className="mt-6 rounded-xl border bg-white p-6 text-left text-sm">
          {result.confirmationCode ? (
            <p>
              <span className="text-stone-500">Confirmation </span>
              <span className="font-semibold">{result.confirmationCode}</span>
            </p>
          ) : null}
          <p className="mt-2">
            <span className="text-stone-500">Property </span>
            {result.propertyName}
          </p>
          <p className="mt-2">
            <span className="text-stone-500">Check-in </span>
            {result.checkIn}
          </p>
          <p className="mt-1">
            <span className="text-stone-500">Check-out </span>
            {result.checkOut}
          </p>
          <p className="mt-1">
            <span className="text-stone-500">Guests </span>
            {result.guests}
          </p>
        </div>
        <p className="mt-6 text-sm text-stone-600">
          Pre-arrival details and any remaining steps will arrive through
          your guest portal and email.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/contact?service=stay" className="rounded-full border px-6 py-3 text-sm font-semibold">
            Need help?
          </Link>
          <Link href="/terms#cancellation" className="rounded-full border px-6 py-3 text-sm font-semibold">
            View cancellation policy
          </Link>
        </div>
      </div>
    </main>
  );
}
