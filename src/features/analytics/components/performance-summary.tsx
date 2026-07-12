import {
  AlertTriangle,
  CheckCircle2,
  Info,
  MinusCircle,
} from "lucide-react";

import type { PerformanceInsight } from "../types";

type PerformanceSummaryProps = {
  insights: PerformanceInsight[];
};

const toneStyles = {
  positive: {
    icon: CheckCircle2,
    wrapper: "border-emerald-200 bg-emerald-50/60",
    iconWrapper: "bg-emerald-100 text-emerald-700",
  },
  warning: {
    icon: AlertTriangle,
    wrapper: "border-amber-200 bg-amber-50/60",
    iconWrapper: "bg-amber-100 text-amber-700",
  },
  informational: {
    icon: Info,
    wrapper: "border-blue-200 bg-blue-50/60",
    iconWrapper: "bg-blue-100 text-blue-700",
  },
  neutral: {
    icon: MinusCircle,
    wrapper: "border-neutral-200 bg-neutral-50",
    iconWrapper: "bg-neutral-200 text-neutral-700",
  },
};

export function PerformanceSummary({
  insights,
}: PerformanceSummaryProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-neutral-500">
          Executive overview
        </p>

        <h2 className="mt-1 text-xl font-semibold text-neutral-950">
          Performance summary
        </h2>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {insights.map((insight) => {
          const styles = toneStyles[insight.tone];
          const Icon = styles.icon;

          return (
            <article
              key={insight.id}
              className={`rounded-xl border p-4 ${styles.wrapper}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.iconWrapper}`}
                >
                  <Icon
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-neutral-950">
                    {insight.title}
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-neutral-600">
                    {insight.description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
