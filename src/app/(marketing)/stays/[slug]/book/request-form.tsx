"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { previewBookingRequestQuote, submitBookingRequest } from "@/app/actions/booking-requests";
import { track } from "@/lib/analytics/track";

type Step = "form" | "review" | "submitting";

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export function RequestForm({
  propertySlug,
  propertyName,
  maxGuests,
  minimumNights,
  initialArrival,
  initialDeparture,
  initialGuests,
}: {
  propertySlug: string;
  propertyName: string;
  maxGuests: number;
  minimumNights: number;
  initialArrival: string;
  initialDeparture: string;
  initialGuests?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [arrival, setArrival] = useState(initialArrival);
  const [departure, setDeparture] = useState(initialDeparture);
  const [adults, setAdults] = useState(initialGuests ? Math.max(1, initialGuests) : 1);
  const [children, setChildren] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");
  const [accessibilityNeeds, setAccessibilityNeeds] = useState("");
  const [consent, setConsent] = useState(false);
  const [quote, setQuote] = useState<{ nights: number; totalMinor: number; currency: string; subtotalMinor: number; cleaningFeeMinor: number; taxMinor: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleReview() {
    const nextErrors: string[] = [];
    if (!arrival) nextErrors.push("Check-in date is required.");
    if (!departure) nextErrors.push("Check-out date is required.");
    if (arrival && departure && departure <= arrival) nextErrors.push("Check-out must be after check-in.");
    if (adults < 1) nextErrors.push("At least one adult is required.");
    if (adults + children > maxGuests) nextErrors.push(`This stay accommodates up to ${maxGuests} guests.`);
    if (!fullName.trim()) nextErrors.push("Your name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.push("A valid email is required.");
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);

    const result = await previewBookingRequestQuote({ propertySlug, arrival, departure });
    if (!result.ok) {
      setErrors([
        result.code === "invalid_dates"
          ? `Stays require a minimum of ${minimumNights} nights.`
          : "We couldn't calculate an estimate for these dates. Please try again or contact us.",
      ]);
      return;
    }
    setQuote(result);
    track("request_started", { propertySlug });
    setStep("review");
  }

  async function handleSend() {
    if (!consent) {
      setErrors(["Please confirm you understand this is a request, not a confirmed reservation."]);
      return;
    }
    setStep("submitting");
    const result = await submitBookingRequest({
      propertySlug,
      arrival,
      departure,
      adults,
      children,
      fullName,
      email,
      phone: phone || undefined,
      visitPurpose: visitPurpose || undefined,
      accessibilityNeeds: accessibilityNeeds || undefined,
      consentAcknowledged: consent,
    });
    if (!result.ok) {
      setErrors(["We couldn't send your request. Please try again or contact us."]);
      setStep("review");
      return;
    }
    track("request_submitted", { propertySlug });
    router.push(`/stays/booking/status?request=${result.requestToken}`);
  }

  if (step === "review" && quote) {
    return (
      <div className="mt-8">
        <div className="rounded-xl border-l-4 border-[#b88945] bg-[#f5efe3] p-4 text-sm leading-6">
          <b>Estimate only.</b> Dates are not held. Taxes, fees, and stay terms will be confirmed before
          payment.
        </div>
        <div className="mt-4 grid gap-6 rounded-xl border bg-white p-6 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl">Review your request</h2>
            <p className="mt-2 text-sm text-stone-600">
              {propertyName} · {arrival} to {departure} · {quote.nights} nights
            </p>
            <p className="text-sm text-stone-600">
              {adults} adult{adults === 1 ? "" : "s"}
              {children ? `, ${children} child${children === 1 ? "" : "ren"}` : ""}
            </p>
            <p className="mt-2 text-sm text-stone-600">Contact: {email}</p>
            {visitPurpose ? <p className="text-sm text-stone-600">Purpose: {visitPurpose}</p> : null}
          </div>
          <div>
            <h3 className="font-serif text-xl">Estimated total</h3>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>{quote.nights} nights</dt>
                <dd>{formatMoney(quote.subtotalMinor, quote.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Cleaning</dt>
                <dd>{formatMoney(quote.cleaningFeeMinor, quote.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Estimated taxes</dt>
                <dd>{formatMoney(quote.taxMinor, quote.currency)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                <dt>Estimated total</dt>
                <dd>{formatMoney(quote.totalMinor, quote.currency)}</dd>
              </div>
            </dl>
            <label className="mt-5 flex items-start gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
              I understand this is a request, not a confirmed reservation, and nothing has been charged.
            </label>
            {errors.length ? (
              <div role="alert" className="mt-3 text-xs text-red-700">
                {errors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSend}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Send booking request
            </button>
            <p className="mt-2 text-center text-xs text-stone-500">Nothing charged today.</p>
            <button type="button" onClick={() => setStep("form")} className="mt-3 w-full text-center text-xs underline">
              Edit details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-8 grid gap-6 rounded-xl border bg-white p-6 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        void handleReview();
      }}
      aria-busy={step === "submitting"}
    >
      <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Check in
          <input type="date" required value={arrival} onChange={(event) => setArrival(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Check out
          <input type="date" required value={departure} onChange={(event) => setDeparture(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
        </label>
      </div>

      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Adults
        <input type="number" min={1} value={adults} onChange={(event) => setAdults(Number(event.target.value))} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Children
        <input type="number" min={0} value={children} onChange={(event) => setChildren(Number(event.target.value))} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
      </label>
      <p className="col-span-full text-xs text-stone-500">Pets are not permitted at this property.</p>

      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Full name
        <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Email
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Mobile (optional)
        <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
      </label>
      <div />

      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:col-span-2">
        Purpose of stay (optional)
        <input value={visitPurpose} onChange={(event) => setVisitPurpose(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:col-span-2">
        Accessibility needs (optional)
        <input value={accessibilityNeeds} onChange={(event) => setAccessibilityNeeds(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
      </label>

      {errors.length ? (
        <div role="alert" className="sm:col-span-2 text-xs text-red-700">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <button type="submit" className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          Review estimate
        </button>
        <p className="mt-3 text-center text-xs text-stone-500">
          Read our <Link href="/terms" className="underline">booking terms</Link> and{" "}
          <Link href="/privacy" className="underline">privacy notice</Link> before you request.
        </p>
      </div>
    </form>
  );
}
