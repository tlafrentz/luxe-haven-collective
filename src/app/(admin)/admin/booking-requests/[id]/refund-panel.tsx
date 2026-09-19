"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refundBooking } from "@/app/actions/booking-requests";
import { StatusPill } from "@/components/admin/operations-ui";
import type { BookingRefundSummary } from "@/features/booking-requests/application";
import { REFUND_REASON_MAX_LENGTH } from "@/features/booking-requests/domain";

const fmtMoney = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
const fmtDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

/** Exact decimal-string -> minor units, avoiding float rounding (e.g. 19.99 * 100). */
function parseAmountToMinor(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
}

function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function RefundPanel({ booking }: { booking: BookingRefundSummary }) {
  const router = useRouter();
  const [amount, setAmount] = useState(() => minorToInput(booking.refundableMinor));
  const [reason, setReason] = useState("");
  const [cancelOverride, setCancelOverride] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // One key per intended refund: a double click or a retry after a dropped
  // response reuses it, so the server can never issue the refund twice.
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const amountMinor = parseAmountToMinor(amount);
  const isFullRemaining = amountMinor !== null && amountMinor === booking.refundableMinor;
  const cancelBooking = cancelOverride ?? isFullRemaining;
  const canRefund = booking.refundableMinor > 0;
  const amountError =
    amountMinor === null || amountMinor <= 0
      ? "Enter an amount greater than zero."
      : amountMinor > booking.refundableMinor
        ? `Cannot exceed ${fmtMoney(booking.refundableMinor, booking.currency)}.`
        : null;
  const formValid = !amountError && reason.trim().length > 0;
  // Cancelling only takes effect on a refund that returns the full payment.
  const cancelWillApply = cancelBooking && amountMinor !== null && booking.refundedMinor + amountMinor >= booking.paidMinor;

  async function submit() {
    if (amountMinor === null) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await refundBooking(booking.bookingId, { amountMinor, reason, cancelBooking, requestKey });
      if (result.ok) {
        setNotice(result.cancelled ? "Refund issued and booking cancelled. A calendar-release task was added to the Action Center." : "Refund issued.");
        setReason("");
        setConfirming(false);
        setCancelOverride(null);
        setRequestKey(crypto.randomUUID());
        router.refresh();
      } else {
        setError(result.message);
        setConfirming(false);
        // A definitive rejection is final for this key; a fresh attempt needs a fresh key.
        setRequestKey(crypto.randomUUID());
        router.refresh();
      }
    } catch (err) {
      // Outcome unknown (e.g. network drop): keep the key so a retry is safe.
      setError(err instanceof Error ? err.message : "Something went wrong. Check the refund history before retrying.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Payment &amp; refunds</h2>
        {booking.bookingCode ? <span className="text-sm text-stone-500">{booking.bookingCode}</span> : null}
        <StatusPill value={booking.bookingStatus} />
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-stone-500">Paid</dt><dd className="text-lg font-semibold">{fmtMoney(booking.paidMinor, booking.currency)}</dd></div>
        <div><dt className="text-stone-500">Refunded</dt><dd className="text-lg font-semibold">{fmtMoney(booking.refundedMinor, booking.currency)}</dd></div>
        <div><dt className="text-stone-500">Still refundable</dt><dd className="text-lg font-semibold">{fmtMoney(booking.refundableMinor, booking.currency)}</dd></div>
      </dl>

      {booking.refunds.length ? (
        <ul className="mt-4 space-y-2 border-t pt-3 text-sm text-stone-700">
          {booking.refunds.map((refund) => (
            <li key={refund.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{fmtMoney(refund.amountMinor, booking.currency)}</span>
              <StatusPill value={refund.status} />
              <span className="text-stone-500">{fmtDate(refund.createdAt)}</span>
              {refund.origin === "stripe_dashboard" ? <span className="text-xs text-stone-500">issued in Stripe</span> : null}
              {refund.failureCode ? <span className="text-xs text-red-700">{refund.failureCode}</span> : null}
              {refund.reason ? <span className="w-full text-stone-600">{refund.reason}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {canRefund ? (
        <form
          className="mt-5 space-y-4 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!formValid) return;
            if (!confirming) {
              setConfirming(true);
              return;
            }
            void submit();
          }}
        >
          <h3 className="font-semibold">Issue a refund</h3>
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <label className="text-sm">
              <span className="text-stone-600">Amount ({booking.currency})</span>
              <input
                inputMode="decimal"
                value={amount}
                disabled={busy}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setConfirming(false);
                }}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
              {amountError ? <span className="mt-1 block text-xs text-red-700">{amountError}</span> : null}
            </label>
            <label className="text-sm">
              <span className="text-stone-600">Reason (kept in the audit record)</span>
              <input
                value={reason}
                maxLength={REFUND_REASON_MAX_LENGTH}
                disabled={busy}
                onChange={(event) => {
                  setReason(event.target.value);
                  setConfirming(false);
                }}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={cancelBooking}
              disabled={busy}
              onChange={(event) => {
                setCancelOverride(event.target.checked);
                setConfirming(false);
              }}
              className="mt-1"
            />
            <span>
              Also cancel this booking
              <span className="block text-xs text-stone-500">Takes effect only when the total refunded equals the full amount paid. Adds a task to release the calendar hold.</span>
            </span>
          </label>

          {confirming && amountMinor !== null ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Refund {fmtMoney(amountMinor, booking.currency)} to the guest&apos;s original payment method
              {cancelWillApply ? " and cancel the booking" : ""}? This cannot be undone.
            </div>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy || !formValid}
              className="rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Processing…" : confirming ? "Confirm refund" : "Review refund"}
            </button>
            {confirming && !busy ? (
              <button type="button" onClick={() => setConfirming(false)} className="rounded-full border px-5 py-2 text-sm font-semibold">
                Back
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-stone-500">Nothing remains to refund.</p>
      )}
    </section>
  );
}
