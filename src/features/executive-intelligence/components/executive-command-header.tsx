import {
  Building2,
  CalendarDays,
  Sparkles,
} from "lucide-react";

import type {
  ExecutiveIntelligenceReport,
} from "../domain";

type ExecutiveCommandHeaderProps = {
  report: ExecutiveIntelligenceReport;
};

function formatDateRange(
  startDate: string,
  endDate: string,
) {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return `${formatter.format(
    new Date(startDate),
  )} – ${formatter.format(new Date(endDate))}`;
}

export function ExecutiveCommandHeader({
  report,
}: ExecutiveCommandHeaderProps) {
  const scopeLabel =
    report.selectedProperty?.name ??
    `${report.portfolioSnapshot.propertyCount} ${
      report.portfolioSnapshot.propertyCount === 1
        ? "property"
        : "properties"
    }`;

  return (
    <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <Sparkles className="h-3.5 w-3.5" />
          Executive Intelligence
        </div>

        <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
          Your hospitality business, distilled into what matters next.
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
          Review portfolio health, understand current risks,
          and focus on the highest-impact actions.
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm text-stone-600 sm:flex-row sm:items-center sm:gap-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm">
          <Building2 className="h-4 w-4 text-stone-400" />
          {scopeLabel}
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm">
          <CalendarDays className="h-4 w-4 text-stone-400" />
          {formatDateRange(
            report.dateRange.startDate,
            report.dateRange.endDate,
          )}
        </div>
      </div>
    </header>
  );
}
