import {
  CheckCircle2,
} from "lucide-react";

import type {
  ExecutivePriority,
} from "../domain";

import {
  ExecutivePriorityCard,
} from "./executive-priority-card";

import {
  SectionHeading,
} from "./section-heading";

type ExecutivePriorityListProps = {
  priorities: ExecutivePriority[];
  revenueIntelligenceHref: string;
};

export function ExecutivePriorityList({
  priorities,
  revenueIntelligenceHref,
}: ExecutivePriorityListProps) {
  return (
    <section>
      <SectionHeading
        eyebrow="Decision queue"
        title="Today’s priorities"
        description="Ranked by urgency, confidence, and expected business impact."
      />

      <div className="mt-5 space-y-4">
        {priorities.length > 0 ? (
          priorities.map((priority) => (
            <ExecutivePriorityCard
              key={priority.id}
              priority={priority}
              reviewHref={
                revenueIntelligenceHref
              }
            />
          ))
        ) : (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />

            <h3 className="mt-4 text-base font-semibold text-emerald-950">
              No urgent priorities detected
            </h3>

            <p className="mt-2 text-sm text-emerald-700">
              Continue monitoring performance as new
              data becomes available.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
