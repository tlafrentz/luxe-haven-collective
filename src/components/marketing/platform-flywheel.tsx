"use client";

import { useState } from "react";
import Link from "next/link";
import { lifecycleStages, type LifecycleStage } from "@/lib/plans";

export function PlatformFlywheel({
  initialStage = "observe",
}: {
  initialStage?: LifecycleStage;
}) {
  const [activeSlug, setActiveSlug] = useState<LifecycleStage>(initialStage);
  const active =
    lifecycleStages.find((stage) => stage.slug === activeSlug) ??
    lifecycleStages[0];

  return (
    <div>
      {/* Desktop: interactive selector */}
      <div className="hidden lg:grid lg:grid-cols-[.55fr_1fr] lg:gap-10">
        <div className="grid gap-3">
          {lifecycleStages.map((stage, index) => (
            <button
              key={stage.slug}
              type="button"
              aria-pressed={activeSlug === stage.slug}
              aria-controls="flywheel-detail"
              onMouseEnter={() => setActiveSlug(stage.slug)}
              onFocus={() => setActiveSlug(stage.slug)}
              onClick={() => setActiveSlug(stage.slug)}
              className={`flex items-center gap-4 rounded-xl border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                activeSlug === stage.slug
                  ? "border-emerald-800 bg-white shadow-sm"
                  : "border-[#dce2dd] bg-transparent hover:border-[#8da098]"
              }`}
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold ${
                  activeSlug === stage.slug
                    ? "border-emerald-800 bg-emerald-900 text-white"
                    : "border-[#c9bfa9] text-[#074e38]"
                }`}
              >
                {index + 1}
              </span>
              <div>
                <p className="font-semibold">{stage.label}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {stage.capabilities.map((c) => c.name).join(" · ")}
                </p>
              </div>
            </button>
          ))}
        </div>
        <div
          id="flywheel-detail"
          aria-live="polite"
          className="rounded-2xl bg-[#0b3f31] p-8 text-white"
        >
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b75d]">
            {active.label}
          </p>
          <p className="mt-4 text-lg leading-8 text-white/85">
            {active.description}
          </p>
          <div className="mt-7 grid gap-4">
            {active.capabilities.map((capability) => (
              <div key={capability.name} className="rounded-xl bg-white/10 p-4">
                <p className="font-semibold">{capability.name}</p>
                <p className="mt-1 text-sm text-white/70">
                  {capability.description}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/performance/plans"
            className="mt-7 inline-flex rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#074e38]"
          >
            Compare Plans →
          </Link>
        </div>
      </div>

      {/* Mobile / accessible fallback: always-expanded vertical list */}
      <div className="grid gap-5 lg:hidden">
        {lifecycleStages.map((stage, index) => (
          <div
            key={stage.slug}
            className="rounded-xl border border-[#dce2dd] bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[#c9bfa9] text-sm font-bold text-[#074e38]">
                {index + 1}
              </span>
              <p className="font-serif text-xl">{stage.label}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              {stage.description}
            </p>
            <ul className="mt-4 space-y-2">
              {stage.capabilities.map((capability) => (
                <li key={capability.name} className="text-sm">
                  <span className="font-semibold">{capability.name}</span>
                  <span className="text-stone-500"> — {capability.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
