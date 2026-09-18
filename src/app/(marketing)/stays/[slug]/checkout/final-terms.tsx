"use client";

import { useState } from "react";
import Link from "next/link";
import { createPaymentInvitation } from "@/app/actions/booking-requests";
import { track } from "@/lib/analytics/track";

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

function formatDeadline(value: string | null): string {
  if (!value) return "the expiration shown in your confirmation email";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function FinalTerms({
  requestToken,
  propertyName,
  arrival,
  departure,
  totalMinor,
  currency,
  slaDueAt,
}: {
  requestToken: string;
  propertyName: string;
  arrival: string;
  departure: string;
  totalMinor: number | null;
  currency: string | null;
  slaDueAt: string | null;
}) {
  const [accepted, setAccepted] = useState(false);
  const [state, setState] = useState<"idle" | "redirecting" | "error" | "unavailable">("idle");

  async function handlePay() {
    if (!accepted) return;
    setState("redirecting");
    track("payment_started", { requestToken });
    const result = await createPaymentInvitation(requestToken);
    if (!result.ok) {
      setState(result.code === "gate_not_ready" ? "unavailable" : "error");
      return;
    }
    track("payment_invited", { requestToken });
    window.location.assign(result.redirectUrl);
  }

  return (
    <main className="bg-[#fffdf9] py-12">
      <div className="container-shell max-w-3xl">
        <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Dates temporarily held
        </span>
        <h1 className="mt-3 font-serif text-4xl">Complete payment by {formatDeadline(slaDueAt)}</h1>

        <div className="mt-6 grid gap-6 rounded-xl border bg-white p-6 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl">Final terms</h2>
            <p className="mt-2 text-sm text-stone-600">
              {propertyName} · {arrival} to {departure}
            </p>
            <label className="mt-5 flex items-start gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5" />
              I accept the{" "}
              <Link href="/terms" className="underline">
                rental agreement, house rules, and cancellation policy
              </Link>
              .
            </label>
            <p className="mt-4 text-xs text-stone-500">
              Payment is collected securely by Stripe. Luxe Haven never receives or stores your card
              details.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl">Amount due</h3>
            {totalMinor !== null && currency ? (
              <p className="mt-3 font-serif text-4xl">{formatMoney(totalMinor, currency)}</p>
            ) : (
              <p className="mt-3 text-sm text-stone-600">Amount will be confirmed by our team.</p>
            )}
            {state === "error" ? (
              <p role="alert" className="mt-3 text-xs text-red-700">
                We couldn&apos;t open secure checkout. Please try again or contact support.
              </p>
            ) : null}
            {state === "unavailable" ? (
              <p role="alert" className="mt-3 text-xs text-red-700">
                This payment link is no longer available — the hold may have expired. Contact support
                for next steps.
              </p>
            ) : null}
            <button
              type="button"
              onClick={handlePay}
              disabled={!accepted || state === "redirecting"}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {state === "redirecting" ? "Opening secure checkout…" : "Pay securely with Stripe"}
            </button>
            <p className="mt-2 text-center text-xs text-stone-500">
              Secure hosted payment · link expires with the calendar hold
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
