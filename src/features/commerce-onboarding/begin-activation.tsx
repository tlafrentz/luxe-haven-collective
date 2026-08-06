"use client";

import Link from "next/link";
import { Cable, ClipboardList, Upload } from "lucide-react";
import { track } from "@/lib/analytics/track";
import type { Plan } from "@/lib/plans";

const connectionOptions = [
  { label: "Connect Airbnb", description: "Connect your Airbnb account to import properties.", icon: Cable },
  { label: "Manual Setup", description: "Add your properties manually.", icon: ClipboardList },
  { label: "Import Existing Portfolio", description: "Import from Excel or another system.", icon: Upload },
];

export function BeginActivation({ plan }: { plan: Plan }) {
  const benefits = Object.values(plan.featuresByStage).flat().slice(0, 4);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
        Let&apos;s connect your first property
      </p>
      <h1 className="mt-3 font-serif text-4xl">Let&apos;s connect your first property.</h1>
      <p className="mt-3 text-sm leading-7 text-stone-600">
        This unlocks the power of the platform. Estimated time: 3 minutes.
      </p>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-stone-500">
        Benefits unlocked
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {benefits.map((benefit) => (
          <li key={benefit} className="rounded-xl border border-[#dce2dd] bg-white px-4 py-3 text-sm font-semibold">
            {benefit}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-stone-500">
        How would you like to get started?
      </h2>
      <div className="mt-3 divide-y rounded-2xl border border-[#dce2dd] bg-white">
        {connectionOptions.map(({ label, description, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#c9bfa9] text-[#074e38]">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-stone-500">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/setup"
        onClick={() => track("activation_started", { plan: plan.slug })}
        className="mt-8 flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-6 text-sm font-semibold text-white"
      >
        Connect My First Property →
      </Link>
    </div>
  );
}
