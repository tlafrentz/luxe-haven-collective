"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuizDraft } from "./use-quiz-draft";
import { AboutYouStep } from "./steps/about-you";
import { BusinessStep } from "./steps/business";
import { GoalsStep } from "./steps/goals";
import { RecommendationStep } from "./steps/recommendation";

const steps = ["about", "business", "goals", "recommendation"] as const;
type Step = (typeof steps)[number];

const stepLabels: Record<Step, string> = {
  about: "About You",
  business: "Business",
  goals: "Goals",
  recommendation: "Recommendation",
};

export function QuizWizard({ initialStep }: { initialStep?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { answers, setAnswers, resetDraft } = useQuizDraft();

  const step: Step = steps.includes(initialStep as Step)
    ? (initialStep as Step)
    : "about";
  const stepIndex = steps.indexOf(step);

  function goToStep(next: Step) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", next);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleStartOver() {
    resetDraft();
    goToStep("about");
  }

  const canGoNext =
    (step === "about" && Boolean(answers.audience)) ||
    (step === "business" && Boolean(answers.propertyCount)) ||
    (step === "goals" && Boolean(answers.primaryGoal));

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-400">
        {steps.map((item, index) => (
          <li
            key={item}
            className={`flex items-center gap-2 ${index <= stepIndex ? "text-emerald-800" : ""}`}
          >
            <span
              className={`grid size-6 place-items-center rounded-full border ${
                index <= stepIndex ? "border-emerald-800" : "border-stone-300"
              }`}
            >
              {index + 1}
            </span>
            {stepLabels[item]}
            {index < steps.length - 1 ? (
              <span aria-hidden className="mx-1 text-stone-300">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
        {step === "about" ? (
          <AboutYouStep
            answers={answers}
            onSelect={(audience) => setAnswers((a) => ({ ...a, audience }))}
          />
        ) : null}
        {step === "business" ? (
          <BusinessStep
            answers={answers}
            onSelect={(propertyCount) =>
              setAnswers((a) => ({ ...a, propertyCount }))
            }
          />
        ) : null}
        {step === "goals" ? (
          <GoalsStep
            answers={answers}
            onSelectGoal={(primaryGoal) =>
              setAnswers((a) => ({ ...a, primaryGoal }))
            }
            onToggleIntegration={(integration) =>
              setAnswers((a) => {
                const current = a.integrations ?? [];
                const integrations = current.includes(integration)
                  ? current.filter((item) => item !== integration)
                  : [...current, integration];
                return { ...a, integrations };
              })
            }
          />
        ) : null}
        {step === "recommendation" ? (
          <RecommendationStep
            answers={answers}
            onCustomize={() => goToStep("goals")}
          />
        ) : null}

        {step !== "recommendation" ? (
          <div className="mt-8 flex items-center justify-between">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => goToStep(steps[stepIndex - 1])}
                className="text-sm font-semibold text-stone-500"
              >
                ← Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => goToStep(steps[stepIndex + 1])}
              className="inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === "goals" ? "See my recommendation" : "Next"} →
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <button
              type="button"
              onClick={handleStartOver}
              className="text-sm font-semibold text-stone-500 underline"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
