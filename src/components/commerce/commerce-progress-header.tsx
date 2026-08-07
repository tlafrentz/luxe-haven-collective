import Link from "next/link";
import { Check } from "lucide-react";

const defaultSteps = ["plan", "workspace", "account", "review", "checkout"] as const;
export type CommerceStep = (typeof defaultSteps)[number];

const defaultStepLabels: Record<CommerceStep, string> = {
  plan: "Plan",
  workspace: "Workspace",
  account: "Account",
  review: "Review",
  checkout: "Checkout",
};

export function CommerceProgressHeader({
  current,
  steps = defaultSteps,
  labels = defaultStepLabels,
}: {
  current: string;
  steps?: readonly string[];
  labels?: Record<string, string>;
}) {
  const currentIndex = steps.indexOf(current);
  return (
    <header className="border-b border-[#dde1dd] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link
          href="/"
          aria-label="Luxe Haven Collective home"
          className="flex shrink-0 items-center gap-3 text-[#8d6b1d]"
        >
          <span className="font-serif text-2xl leading-none">LH</span>
        </Link>
        <ol className="flex min-w-max items-center gap-2 overflow-x-auto text-xs font-bold uppercase tracking-wide text-stone-400">
          {steps.map((step, index) => {
            const state =
              index < currentIndex ? "done" : index === currentIndex ? "current" : "future";
            return (
              <li key={step} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                    state === "done"
                      ? "border-emerald-800 bg-emerald-900 text-white"
                      : state === "current"
                        ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                        : "border-stone-300 text-stone-400"
                  }`}
                >
                  {state === "done" ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className={state === "future" ? "" : "text-[#171c19]"}>
                  {labels[step] ?? step}
                </span>
                {index < steps.length - 1 ? (
                  <span aria-hidden className="mx-1 text-stone-300">
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <nav aria-label="Help" className="flex shrink-0 items-center gap-4 text-sm font-semibold text-stone-600">
          <Link href="/faq" className="hover:text-[#074e38]">
            Help
          </Link>
          <Link href="/contact" className="hover:text-[#074e38]">
            Support
          </Link>
        </nav>
      </div>
    </header>
  );
}
