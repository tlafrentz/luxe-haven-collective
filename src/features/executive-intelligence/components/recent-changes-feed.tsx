import {
  AlertTriangle,
  CircleCheck,
  Info,
} from "lucide-react";

import type {
  PortfolioChange,
} from "../domain";

import {
  SectionHeading,
} from "./section-heading";

type RecentChangesFeedProps = {
  changes: PortfolioChange[];
};

function getToneIcon(
  tone: PortfolioChange["tone"],
) {
  switch (tone) {
    case "positive":
      return CircleCheck;

    case "warning":
    case "negative":
      return AlertTriangle;

    case "informational":
    default:
      return Info;
  }
}

export function RecentChangesFeed({
  changes,
}: RecentChangesFeedProps) {
  return (
    <section>
<SectionHeading
  eyebrow="Daily briefing"
  title="What changed today"
  description="Reservations created today, scheduled arrivals and departures, and new intelligence signals."
/>
      <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        {changes.length > 0 ? (
          changes.map((change, index) => {
            const Icon = getToneIcon(change.tone);

            return (
              <div
                key={change.id}
                className={[
                  "flex gap-4 p-5",
                  index > 0
                    ? "border-t border-stone-100"
                    : "",
                ].join(" ")}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-stone-950">
                      {change.title}
                    </p>

                    <p className="text-xs text-stone-400">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(
                        new Date(change.occurredAt),
                      )}
                    </p>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {change.description}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="p-6 text-sm text-stone-500">
            No recent intelligence changes are available.
          </p>
        )}
      </div>
    </section>
  );
}
