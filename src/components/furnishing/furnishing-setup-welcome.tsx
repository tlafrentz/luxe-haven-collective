import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";
import { furnishingPackages } from "@/lib/furnishing-packages";

const progressSteps = [
  "Welcome",
  "Property & rooms",
  "Package & budget",
  "Design approval",
  "Procurement",
  "Installation & launch",
];

export function FurnishingSetupWelcome({
  packageName,
}: {
  packageName?: string;
}) {
  const pkg = packageName
    ? furnishingPackages.find((item) =>
        packageName.toLowerCase().includes(item.name.toLowerCase()),
      )
    : undefined;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-12">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
          Furnishing Studio
        </p>
        <h1 className="mt-2 text-4xl font-semibold">
          Welcome to your furnishing project.
        </h1>
        <p className="mt-3 text-stone-600">
          Here&apos;s what happens next and how long it typically takes.
        </p>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Purchased service
        </p>
        <p className="mt-2 text-2xl font-semibold">
          {packageName ?? "Furnishing Studio project"}
        </p>
        {pkg ? (
          <p className="mt-1 text-sm text-stone-600">
            Typical project timeline: {pkg.comparison.typicalTimeline}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2 text-violet-700">
            <Clock3 className="size-5" />
            <p className="text-sm font-semibold">Setup takes about 10 minutes</p>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Confirm your property, rooms, package, and target budget. You can
            leave and resume at any time.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2 text-violet-700">
            <CheckCircle2 className="size-5" />
            <p className="text-sm font-semibold">What happens next</p>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            After setup, our team drafts a room-by-room design plan for your
            review and approval before anything is purchased.
          </p>
        </div>
      </section>

      <section>
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Your project journey
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {progressSteps.map((step, index) => (
            <li
              key={step}
              className={`rounded-xl border p-4 text-sm ${index === 0 ? "border-violet-700 bg-violet-50 font-semibold text-violet-800" : "border-stone-200 text-stone-600"}`}
            >
              <span className="text-xs text-stone-400">0{index + 1}</span>
              <p className="mt-1">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href="/dashboard/furnishing/projects/new?step=setup"
        className="inline-flex rounded-xl bg-violet-700 px-6 py-3 text-sm font-semibold text-white"
      >
        Let&apos;s get started
      </Link>
    </main>
  );
}
