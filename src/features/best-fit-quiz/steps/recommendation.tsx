import Link from "next/link";
import { Check } from "lucide-react";
import { PlanCard } from "@/components/marketing/plan-card";
import { plansBySlug } from "@/lib/plans";
import { recommendPlan, type QuizAnswers } from "../scoring";

export function RecommendationStep({
  answers,
  onCustomize,
}: {
  answers: QuizAnswers;
  onCustomize: () => void;
}) {
  const { planSlug, matchingFeatures, alternatives } = recommendPlan(answers);
  const plan = plansBySlug[planSlug];

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a56b19]">
        Your recommendation
      </p>
      <h2 className="mt-4 font-serif text-4xl">
        Based on your goals, {plan.name} is the best fit.
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
        {plan.tagline}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_.5fr]">
        <div>
          <h3 className="font-semibold">Why this fits</h3>
          <ul className="mt-4 space-y-3">
            <li className="flex gap-3 text-sm text-stone-600">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              Supports {plan.comparisonRow.properties.toLowerCase()} properties
              and {plan.comparisonRow.users.toLowerCase()} users
            </li>
            {matchingFeatures.map((feature) => (
              <li key={feature} className="flex gap-3 text-sm text-stone-600">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/commerce/configure-workspace?plan=${plan.slug}&billing=monthly`}
              className="inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white"
            >
              Start with {plan.name}
            </Link>
            <button
              type="button"
              onClick={onCustomize}
              className="inline-flex min-h-11 items-center rounded-md border border-[#789487] bg-white px-5 text-sm font-semibold"
            >
              Customize Recommendation
            </button>
            <Link
              href={`/performance/plans?plan=${plan.slug}`}
              className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#074e38] underline"
            >
              Compare Plans
            </Link>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500">
            Alternatives
          </h3>
          <div className="mt-4 grid gap-4">
            {alternatives.map((altSlug) => (
              <PlanCard
                key={altSlug}
                plan={plansBySlug[altSlug]}
                billing="monthly"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
