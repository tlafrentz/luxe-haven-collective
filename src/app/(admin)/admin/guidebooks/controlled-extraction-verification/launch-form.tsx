"use client";
import { useMemo, useState } from "react";
import { launchControlledExtractionAction } from "@/app/actions/controlled-guidebook-extraction";
type Customer = {
  id: string;
  name: string;
  entitlements: { id: string; label: string; effectiveUntil: string | null }[];
};
export function LaunchForm({
  customers,
  emptyReason,
}: {
  customers: Customer[];
  emptyReason: string | null;
}) {
  const first =
      customers.find((customer) => customer.entitlements.length)?.id ??
      customers[0]?.id ??
      "",
    [customerId, setCustomerId] = useState(first),
    customer = useMemo(
      () => customers.find((value) => value.id === customerId) ?? null,
      [customers, customerId],
    ),
    grants = customer?.entitlements ?? [];
  return (
    <form
      action={launchControlledExtractionAction}
      className="space-y-5 rounded-xl border bg-white p-6"
    >
      <label className="block font-semibold">
        Controlled customer
        <select
          name="customerAccountId"
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          className="mt-2 w-full rounded-lg border p-3"
        >
          <option value="" disabled>
            Select a controlled customer
          </option>
          {customers.map((value) => (
            <option key={value.id} value={value.id}>
              {value.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-semibold">
        Eligible Guidebook entitlement
        <select
          key={customerId}
          name="entitlementId"
          required
          defaultValue={grants[0]?.id ?? ""}
          disabled={!grants.length}
          className="mt-2 w-full rounded-lg border p-3"
        >
          <option value="" disabled>
            {grants.length
              ? "Select an eligible grant"
              : "No eligible grant for this customer"}
          </option>
          {grants.map((grant) => (
            <option key={grant.id} value={grant.id}>
              {grant.label}
            </option>
          ))}
        </select>
      </label>
      {emptyReason || !grants.length ? (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          {emptyReason ??
            "This controlled customer has no active, unexpired, unrevoked, unallocated Guidebook grant."}
        </p>
      ) : null}
      <section className="rounded-lg bg-amber-50 p-4 text-sm">
        <p className="font-semibold">Controlled summary</p>
        <p className="mt-1">
          Fictional verification property; one short non-sensitive text source;
          two non-sensitive sample images; Nano extraction; Mini draft
          generation; canonical Builder save, preview, section regeneration and
          restoration; $1 server ceiling; no publication, credentials,
          addresses, access data, or guest information.
        </p>
      </section>
      <button
        disabled={!customer || !grants.length}
        className="rounded-lg bg-stone-950 px-5 py-3 font-semibold text-white disabled:opacity-40"
      >
        Run Guidebook Auto-Create verification once
      </button>
    </form>
  );
}
