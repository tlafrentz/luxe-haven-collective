import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpenText, ListChecks, MapPinned, Sparkles, Wifi } from "lucide-react";

export function GuidebookEmptyState({
  hasProperties,
  addPropertyHref,
  createHref,
}: {
  hasProperties: boolean;
  addPropertyHref: string;
  createHref: string;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-stone-50 to-white p-10 text-center sm:p-14">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-900 text-white">
        <Sparkles className="size-6" />
      </span>
      <h2 className="mt-6 text-2xl font-semibold sm:text-3xl">
        {hasProperties
          ? "Create your first guidebook"
          : "Add a property to get started"}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm text-stone-600">
        {hasProperties
          ? "Give every guest one trusted, always-current place to check in, connect to Wi-Fi, explore the area, and prepare for departure — no more laminated binders."
          : "Guidebook Studio publishes a guest experience for a specific property. Add or import your first property, then come back here to build its guidebook."}
      </p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-3">
        <Feature icon={<Wifi className="size-5" />} label="Wi-Fi & check-in" />
        <Feature
          icon={<MapPinned className="size-5" />}
          label="Local recommendations"
        />
        <Feature
          icon={<ListChecks className="size-5" />}
          label="Departure checklist"
        />
      </div>
      <Link
        href={hasProperties ? createHref : addPropertyHref}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white"
      >
        <BookOpenText className="size-4" />
        {hasProperties ? "Create in Guidebook Studio" : "Add your first property"}
      </Link>
    </section>
  );
}

function Feature({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/70 p-4 text-xs font-semibold text-stone-700">
      <span className="text-emerald-700">{icon}</span>
      {label}
    </div>
  );
}
