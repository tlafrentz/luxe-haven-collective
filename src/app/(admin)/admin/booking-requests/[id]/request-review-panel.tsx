"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveRequestForBlock,
  declineRequest,
  proposeAlternateRequestDates,
  recordCalendarBlock,
  releaseCalendarBlock,
} from "@/app/actions/booking-requests";

const CONFLICT_CHECKS = [
  ["ota", "OTA reservations (Airbnb, Vrbo, etc.)"],
  ["direct", "Other direct bookings"],
  ["ownerBlocks", "Owner blocks"],
  ["maintenance", "Maintenance holds"],
  ["buffers", "Preparation/turnover buffers"],
  ["other", "Other pending commitments"],
] as const;

export function RequestReviewPanel({
  requestId,
  status,
  arrival,
  departure,
  activeBlockId,
}: {
  requestId: string;
  status: string;
  arrival: string;
  departure: string;
  activeQuoteId: string | null;
  activeBlockId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "submitted" || status === "under_review") {
    return <ReviewChecklist requestId={requestId} arrival={arrival} departure={departure} busy={busy} error={error} run={run} />;
  }

  if (status === "approved") {
    return <BlockForm requestId={requestId} busy={busy} error={error} run={run} />;
  }

  if (activeBlockId && ["declined", "withdrawn", "expired", "payment_failed"].includes(status)) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-900">Active block needs release</h2>
        <p className="mt-1 text-sm text-amber-800">This request is terminal but its calendar block is still active.</p>
        {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => releaseCalendarBlock(activeBlockId, { outcome: `Released after request ${status}.` }))}
          className="mt-3 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Release block
        </button>
      </section>
    );
  }

  return null;
}

function ReviewChecklist({
  requestId,
  arrival,
  departure,
  busy,
  error,
  run,
}: {
  requestId: string;
  arrival: string;
  departure: string;
  busy: boolean;
  error: string | null;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [showAlternate, setShowAlternate] = useState(false);
  const [altArrival, setAltArrival] = useState(arrival);
  const [altDeparture, setAltDeparture] = useState(departure);
  const [showDecline, setShowDecline] = useState(false);
  const [declineNotes, setDeclineNotes] = useState("");

  const allChecked = CONFLICT_CHECKS.every(([key]) => checks[key]);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Availability checklist</h2>
      <div className="mt-3 grid gap-2 text-sm">
        {CONFLICT_CHECKS.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input type="checkbox" checked={checks[key] ?? false} onChange={(event) => setChecks((prev) => ({ ...prev, [key]: event.target.checked }))} />
            {label}
          </label>
        ))}
      </div>
      <label className="mt-4 grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" rows={2} />
      </label>

      {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !allChecked}
          title={!allChecked ? "Complete the availability checklist first" : undefined}
          onClick={() => run(() => approveRequestForBlock(requestId, { conflictCheckEvidence: checks, notes }))}
          className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Approve for block
        </button>
        <button type="button" onClick={() => setShowAlternate((v) => !v)} className="rounded-full border px-5 py-2.5 text-sm font-semibold">
          Propose alternate
        </button>
        <button type="button" onClick={() => setShowDecline((v) => !v)} className="rounded-full border px-5 py-2.5 text-sm font-semibold">
          Decline
        </button>
      </div>

      {showAlternate ? (
        <div className="mt-4 grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Alternate check-in
            <input type="date" value={altArrival} onChange={(event) => setAltArrival(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Alternate check-out
            <input type="date" value={altDeparture} onChange={(event) => setAltDeparture(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => proposeAlternateRequestDates(requestId, { arrival: altArrival, departure: altDeparture, notes }))}
              className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send alternate proposal
            </button>
          </div>
        </div>
      ) : null}

      {showDecline ? (
        <div className="mt-4 rounded-lg border p-4">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Reason (shown internally, not to the guest)
            <textarea value={declineNotes} onChange={(event) => setDeclineNotes(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" rows={2} />
          </label>
          <button
            type="button"
            disabled={busy || !declineNotes.trim()}
            onClick={() => run(() => declineRequest(requestId, { notes: declineNotes }))}
            className="mt-3 rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirm decline
          </button>
        </div>
      ) : null}
    </section>
  );
}

function BlockForm({
  requestId,
  busy,
  error,
  run,
}: {
  requestId: string;
  busy: boolean;
  error: string | null;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [calendarSystem, setCalendarSystem] = useState("Hospitable");
  const [externalReference, setExternalReference] = useState("");
  const [attestation, setAttestation] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="font-semibold text-amber-900">Record the calendar hold — hard gate</h2>
      <p className="mt-1 text-sm text-amber-800">
        Payment cannot be invited until this is saved. Provide a reference or a written attestation.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Calendar system
          <input value={calendarSystem} onChange={(event) => setCalendarSystem(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          External block reference
          <input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:col-span-2">
          Attestation (if no reference number)
          <textarea value={attestation} onChange={(event) => setAttestation(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" rows={2} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Hold expires
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="rounded-md border px-3 py-2 text-sm font-normal normal-case text-stone-900" />
        </label>
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={busy || !calendarSystem.trim() || !expiresAt || (!externalReference.trim() && !attestation.trim())}
        onClick={() =>
          run(() =>
            recordCalendarBlock(requestId, {
              calendarSystem,
              externalReference: externalReference || undefined,
              attestation: attestation || undefined,
              expiresAt: new Date(expiresAt).toISOString(),
            }),
          )
        }
        className="mt-4 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Save block and enable payment
      </button>
    </section>
  );
}
