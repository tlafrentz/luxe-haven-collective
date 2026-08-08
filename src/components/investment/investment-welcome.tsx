import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";
import { investmentPackages } from "@/lib/investment-packages";

const progressSteps = [
  "Property address",
  "Select strategy",
  "Financial assumptions",
  "Review & run analysis",
];

export function InvestmentWelcome({ packageName }: { packageName?: string }) {
  const pkg = packageName
    ? investmentPackages.find((item) =>
        packageName.toLowerCase().includes(item.name.toLowerCase()),
      )
    : undefined;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-12">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Investment Intelligence
        </p>
        <h1 className="mt-2 text-4xl font-semibold">
          Welcome to Investment Intelligence.
        </h1>
        <p className="mt-3 text-stone-600">
          Let&apos;s analyze your next great opportunity. Here&apos;s what
          happens next.
        </p>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Purchased analysis
        </p>
        <p className="mt-2 text-2xl font-semibold">
          {packageName ?? "Investment Intelligence analysis"}
        </p>
        {pkg ? (
          <p className="mt-1 text-sm text-stone-600">
            Typical turnaround: {pkg.comparison.turnaround}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2 text-emerald-700">
            <Clock3 className="size-5" />
            <p className="text-sm font-semibold">Setup takes about 5 minutes</p>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Enter the property address, choose a strategy, and confirm your
            financial assumptions. You can leave and resume at any time.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="size-5" />
            <p className="text-sm font-semibold">What happens next</p>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Once you run the analysis, you&apos;ll get market intelligence, a
            financial model, and a clear recommendation — every number
            inspectable and traceable to its source.
          </p>
        </div>
      </section>

      <section>
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Your analysis journey
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-4">
          {progressSteps.map((step, index) => (
            <li
              key={step}
              className={`rounded-xl border p-4 text-sm ${index === 0 ? "border-emerald-700 bg-emerald-50 font-semibold text-emerald-800" : "border-stone-200 text-stone-600"}`}
            >
              <span className="text-xs text-stone-400">0{index + 1}</span>
              <p className="mt-1">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href="/dashboard/investments/new"
        className="inline-flex rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Start Analysis
      </Link>
    </main>
  );
}
