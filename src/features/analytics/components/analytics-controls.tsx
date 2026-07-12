"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { AnalyticsProperty } from "../types";

type AnalyticsControlsProps = {
  properties: AnalyticsProperty[];
  selectedPropertyId: string | null;
  startDate: string;
  endDate: string;
};

export function AnalyticsControls({
  properties,
  selectedPropertyId,
  startDate,
  endDate,
}: AnalyticsControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateFilters(
    updates: Record<string, string | null>,
  ) {
    const params = new URLSearchParams(
      searchParams.toString(),
    );

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    startTransition(() => {
const queryString = params.toString();

router.replace(
  queryString ? `${pathname}?${queryString}` : pathname,
  {
    scroll: false,
  },
);
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-700">
            Property
          </span>

          <select
            value={selectedPropertyId ?? ""}
            disabled={isPending}
            onChange={(event) =>
              updateFilters({
                property: event.target.value || null,
              })
            }
            className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">All properties</option>

            {properties.map((property) => (
              <option
                key={property.id}
                value={property.id}
              >
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-700">
            Start date
          </span>

          <input
            type="date"
            value={startDate}
            disabled={isPending}
            onChange={(event) =>
              updateFilters({
                start: event.target.value,
              })
            }
            className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 disabled:cursor-wait disabled:opacity-60"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-700">
            End date
          </span>

          <input
            type="date"
            value={endDate}
            disabled={isPending}
            onChange={(event) =>
              updateFilters({
                end: event.target.value,
              })
            }
            className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 disabled:cursor-wait disabled:opacity-60"
          />
        </label>

        <button
          type="button"
          disabled={isPending}
        onClick={() =>
         startTransition(() => {
        router.replace(pathname, {
       scroll: false,
        });
       })
      }
          className="h-11 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
        >
          Reset
        </button>
      </div>
<div
  aria-live="polite"
  aria-atomic="true"
  className="min-h-5"
>
  {isPending ? (
    <p className="mt-3 text-sm text-neutral-500">
      Updating insights…
    </p>
  ) : null}
</div>
    </section>
  );
}
