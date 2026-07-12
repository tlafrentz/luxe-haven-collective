import {
  Building2,
  CalendarRange,
  ClipboardList,
  Clock3,
} from "lucide-react";

import {
  addDays,
  differenceInNights,
  formatDate,
} from "../lib";
import type { DashboardAnalytics } from "../types";

type ReportContextProps = {
  analytics: DashboardAnalytics;
};

export function ReportContext({
  analytics,
}: ReportContextProps) {
  const selectedProperty = analytics.selectedPropertyId
    ? analytics.properties.find(
        (property) =>
          property.id === analytics.selectedPropertyId,
      )
    : null;

  const propertyLabel =
    selectedProperty?.name ?? "All properties";

  /*
   * Analytics end dates are exclusive, so subtract one day
   * when displaying the reporting period to the user.
   */
  const displayEndDate = addDays(
    analytics.dateRange.endDate,
    -1,
  );

  const periodNights = differenceInNights(
    analytics.dateRange.startDate,
    analytics.dateRange.endDate,
  );

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Current report
          </p>

          <h2 className="mt-1 text-xl font-semibold text-neutral-950">
            {propertyLabel}
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            {formatDate(analytics.dateRange.startDate)}
            {" – "}
            {formatDate(displayEndDate)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ContextItem
            icon={Building2}
            label="Portfolio"
            value={propertyLabel}
          />

          <ContextItem
            icon={CalendarRange}
            label="Reporting period"
            value={`${periodNights} ${
              periodNights === 1 ? "night" : "nights"
            }`}
          />

          <ContextItem
            icon={ClipboardList}
            label="Bookings"
            value={analytics.bookings.length.toString()}
          />

          <ContextItem
            icon={Clock3}
            label="Comparison"
            value="Previous period"
          />
        </div>
      </div>
    </section>
  );
}

type ContextItemProps = {
  icon: typeof Building2;
  label: string;
  value: string;
};

function ContextItem({
  icon: Icon,
  label,
  value,
}: ContextItemProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-neutral-50 px-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200">
        <Icon
          aria-hidden="true"
          className="h-4 w-4"
        />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {label}
        </p>

        <p
          className="mt-0.5 truncate text-sm font-semibold text-neutral-900"
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
