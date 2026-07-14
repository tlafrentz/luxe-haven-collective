"use client";

import {
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  useState,
  useTransition,
} from "react";

import type {
  AnalyticsDateRange,
  AnalyticsProperty,
} from "@/features/analytics";

type ExecutiveScopeControlsProps = {
  properties: AnalyticsProperty[];
  selectedProperty: AnalyticsProperty | null;
  dateRange: AnalyticsDateRange;
};

export function ExecutiveScopeControls({
  properties,
  selectedProperty,
  dateRange,
}: ExecutiveScopeControlsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isPending, startTransition] =
    useTransition();

  const [propertyId, setPropertyId] =
    useState(
      selectedProperty?.id ?? "portfolio",
    );

  const [startDate, setStartDate] =
    useState(dateRange.startDate);

  const [endDate, setEndDate] =
    useState(dateRange.endDate);

  function applyFilters() {
    const params = new URLSearchParams();

    if (propertyId !== "portfolio") {
      params.set("property", propertyId);
    }

    params.set("start", startDate);
    params.set("end", endDate);

    startTransition(() => {
      router.push(
        `${pathname}?${params.toString()}`,
      );
    });
  }

  function resetFilters() {
    setPropertyId("portfolio");

    startTransition(() => {
      router.push(pathname);
    });
  }

  const invalidRange =
    !startDate ||
    !endDate ||
    startDate >= endDate;

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            <SlidersHorizontal className="h-4 w-4" />
            Reporting scope
          </p>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            View the entire portfolio or focus the
            Command Center on one property and reporting
            period.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_160px_auto_auto]">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-stone-600">
              Property
            </span>

            <select
              value={propertyId}
              onChange={(event) =>
                setPropertyId(
                  event.target.value,
                )
              }
              className="h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/10"
            >
              <option value="portfolio">
                Entire portfolio
              </option>

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

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-stone-600">
              Start date
            </span>

            <input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
              className="h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/10"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-stone-600">
              End date
            </span>

            <input
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
              className="h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/10"
            />
          </label>

          <button
            type="button"
            onClick={applyFilters}
            disabled={invalidRange || isPending}
            className="h-11 self-end rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Updating..."
              : "Apply"}
          </button>

          <button
            type="button"
            onClick={resetFilters}
            disabled={isPending}
            aria-label="Reset reporting scope"
            className="flex h-11 w-11 self-end items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {invalidRange ? (
        <p className="mt-3 text-xs font-medium text-rose-700">
          The end date must be later than the start
          date.
        </p>
      ) : null}
    </section>
  );
}
