import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { SetupProgress } from "../domain/setup-steps";

export function SetupShellHeader({ progress }: { progress: SetupProgress | null }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex min-h-[72px] max-w-4xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" aria-label="Luxe Haven Collective home" className="font-serif text-xl text-stone-950">
          LH
        </Link>
        {progress ? (
          <nav aria-label="Setup progress" className="flex min-w-max items-center gap-1">
            {progress.steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-1">
                <span
                  aria-current={progress.currentStep?.id === step.id ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    step.complete
                      ? "bg-emerald-50 text-emerald-800"
                      : progress.currentStep?.id === step.id
                        ? "bg-stone-950 text-white"
                        : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {step.complete ? (
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  ) : (
                    <Circle className="size-3.5" aria-hidden />
                  )}
                  {step.label}
                  {step.skipped ? <span className="text-[10px] uppercase">(skipped)</span> : null}
                </span>
                {index < progress.steps.length - 1 ? (
                  <span aria-hidden className="text-stone-300">
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </nav>
        ) : null}
        <Link href="/contact" className="text-sm font-semibold text-stone-600 hover:text-stone-950">
          Need help?
        </Link>
      </div>
      {progress ? (
        <div className="sr-only" role="status" aria-live="polite">
          {progress.completionPercent}% of workspace setup complete.
        </div>
      ) : null}
    </header>
  );
}
