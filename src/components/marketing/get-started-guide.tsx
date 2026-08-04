"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { publicJourneys } from "@/features/public-experience/journeys";

const options = [
  [
    "guest-experience",
    "Improve guest experience",
    "Create a guidebook, improve communication, or audit the guest journey.",
  ],
  [
    "property-launch",
    "Furnish or launch a property",
    "Coordinate furnishing, guest content, and launch readiness.",
  ],
  [
    "investment",
    "Invest better",
    "Evaluate a property or portfolio opportunity with traceable evidence.",
  ],
  [
    "revenue",
    "Increase revenue",
    "Find conversion, pricing, positioning, and advisory opportunities.",
  ],
  [
    "operations",
    "Operate with the platform",
    "Connect performance signals, decisions, work, and learning.",
  ],
  [
    "stay",
    "Book a Luxe Haven stay",
    "Browse direct-booking properties and plan a stay.",
  ],
] as const;

export function GetStartedGuide({ initialGoal }: { initialGoal?: string }) {
  const [goal, setGoal] = useState(initialGoal ?? "");
  const journey = useMemo(
    () => publicJourneys.find((item) => item.slug === goal),
    [goal],
  );
  const destination =
    goal === "stay" ? "/stays" : journey ? `/solutions/${journey.slug}` : "";
  return (
    <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
      <fieldset>
        <legend className="text-sm font-bold uppercase tracking-[.2em] text-[#087251]">
          How can we help you today?
        </legend>
        <div className="mt-5 grid gap-3">
          {options.map(([value, label, copy]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-2xl border p-5 transition ${goal === value ? "border-[#087251] bg-[#eff8f3] ring-2 ring-[#087251]/20" : "border-[#dce2dd] bg-white hover:border-[#8da098]"}`}
            >
              <input
                type="radio"
                name="goal"
                value={value}
                checked={goal === value}
                onChange={() => {
                  setGoal(value);
                  window.history.replaceState(
                    null,
                    "",
                    `/get-started?goal=${value}`,
                  );
                }}
                className="sr-only"
              />
              <span className="font-semibold">{label}</span>
              <span className="mt-1 block text-sm leading-6 text-[#65706a]">
                {copy}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <section
        aria-live="polite"
        className="rounded-[2rem] bg-[#0b3f31] p-8 text-white lg:sticky lg:top-28 lg:self-start"
      >
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d8b75d]">
          Recommended next step
        </p>
        {destination ? (
          <>
            <h2 className="mt-4 font-serif text-4xl">
              {goal === "stay" ? "Stay With Us" : journey?.title}
            </h2>
            <p className="mt-4 leading-7 text-white/75">
              {goal === "stay"
                ? "Explore published properties, verify dates, and book direct."
                : journey?.description}
            </p>
            <p className="mt-6 text-sm text-white/65">
              Why this fits: it starts with the outcome you selected and takes
              you to the relevant packages and activation path.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={destination}
                className="rounded-md bg-white px-5 py-3 font-semibold text-[#074e38]"
              >
                Review recommendation
              </Link>
              {journey ? (
                <Link
                  href={`/packages?category=${journey.offerCategory}`}
                  className="rounded-md border border-white/25 px-5 py-3 font-semibold"
                >
                  View packages
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-4 font-serif text-4xl">Choose your goal.</h2>
            <p className="mt-4 leading-7 text-white/75">
              We’ll explain the best-fit path before asking you to create an
              account or make a purchase.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
