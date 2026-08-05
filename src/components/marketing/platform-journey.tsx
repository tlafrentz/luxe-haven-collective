import Link from "next/link";
import { Check, ChevronRight, CircleCheck, LockKeyhole } from "lucide-react";
import {
  journeySteps,
  platformJourneys,
  type JourneyStep,
} from "@/lib/platform-journeys";
import { PlatformNavigation } from "./platform-navigation";

const labels: Record<JourneyStep, string> = {
  journey: "Journey",
  "select-package": "Select package",
  "package-details": "Package details",
  customize: "Customize",
  review: "Review & confirm",
  checkout: "Checkout",
  confirmation: "Confirmation",
};

export function PlatformJourney({
  slug,
  step,
  selected,
}: {
  slug: string;
  step: JourneyStep;
  selected?: string;
}) {
  const journey = platformJourneys[slug];
  const chosen =
    journey.packages.find((x) => x.name === selected) ??
    journey.packages.find((x) => x.popular) ??
    journey.packages[0];
  const index = journeySteps.indexOf(step);
  const next = journeySteps[Math.min(index + 1, journeySteps.length - 1)];
  const nextHref = `/platform/${slug}/${next}?package=${encodeURIComponent(chosen.name)}`;
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b py-10">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            {journey.accent}
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-5xl">{journey.name}</h1>
              <p className="mt-3 text-sm text-stone-600">
                {journey.description}
              </p>
            </div>
            <Link
              href={`/platform/${slug}/select-package`}
              className="rounded-md bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Start this journey →
            </Link>
          </div>
        </div>
      </section>
      <PlatformNavigation active={journey.shortName} />
      <div className="container-shell overflow-x-auto py-5">
        <ol className="flex min-w-[850px] items-center justify-between text-[10px] font-bold uppercase tracking-wide">
          {journeySteps.map((item, i) => (
            <li
              key={item}
              className={
                i <= index
                  ? "flex items-center gap-2 text-emerald-800"
                  : "flex items-center gap-2 text-stone-400"
              }
            >
              <span className="grid size-6 place-items-center rounded-full border">
                {i + 1}
              </span>
              {labels[item]}
              {i < journeySteps.length - 1 ? (
                <ChevronRight className="ml-3 size-4" />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <section className="pb-16">
        <div className="container-shell">
          <div className="mx-auto max-w-5xl rounded-2xl border bg-white p-6 shadow-sm md:p-10">
            {step === "journey" ? <JourneyIntro nextHref={nextHref} /> : null}
            {step === "select-package" ? (
              <PackageSelection journey={journey} slug={slug} />
            ) : null}
            {step === "package-details" ? (
              <PackageDetails
                journey={journey}
                chosen={chosen}
                nextHref={nextHref}
              />
            ) : null}
            {step === "customize" ? (
              <Customize journey={journey} nextHref={nextHref} />
            ) : null}
            {step === "review" ? (
              <Review journey={journey} chosen={chosen} nextHref={nextHref} />
            ) : null}
            {step === "checkout" ? (
              <Checkout journey={journey} chosen={chosen} slug={slug} />
            ) : null}
            {step === "confirmation" ? (
              <Confirmation journey={journey} />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

type JourneyData = (typeof platformJourneys)[string];
function JourneyIntro({ nextHref }: { nextHref: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.15em] text-[#a56b19]">
          From selection to success
        </p>
        <h2 className="mt-4 font-serif text-4xl">
          A clear path from choice to first value.
        </h2>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          Choose the right package, confirm the scope, and continue through
          secure checkout and activation without losing context.
        </p>
        <Link
          href={nextHref}
          className="mt-7 inline-flex rounded-md bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Select a package →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          "Choose a package",
          "Review deliverables",
          "Provide essential details",
          "Confirm scope and pricing",
          "Complete secure checkout",
          "Enter the correct workspace",
        ].map((x, i) => (
          <div key={x} className="rounded-xl border bg-stone-50 p-4">
            <span className="text-xs text-[#a56b19]">0{i + 1}</span>
            <p className="mt-2 font-semibold">{x}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
function PackageSelection({
  journey,
  slug,
}: {
  journey: JourneyData;
  slug: string;
}) {
  return (
    <>
      <h2 className="font-serif text-4xl">Choose the package that fits.</h2>
      <p className="mt-3 text-sm text-stone-600">
        Compare scope, delivery, and starting price.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {journey.packages.map((p) => (
          <article
            key={p.name}
            className={
              p.popular
                ? "relative rounded-xl border-2 border-emerald-800 p-6"
                : "rounded-xl border p-6"
            }
          >
            {p.popular ? (
              <span className="absolute right-3 top-3 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                Most popular
              </span>
            ) : null}
            <h3 className="mt-3 font-serif text-2xl">{p.name}</h3>
            <p className="mt-3 text-sm text-stone-600">{p.description}</p>
            <p className="mt-8 text-xl font-bold">{p.price}</p>
            <Link
              href={`/platform/${slug}/package-details?package=${encodeURIComponent(p.name)}`}
              className="mt-5 flex justify-center rounded-md bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Select
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
function PackageDetails({
  journey,
  chosen,
  nextHref,
}: {
  journey: JourneyData;
  chosen: JourneyData["packages"][number];
  nextHref: string;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_.55fr]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
          Package details
        </p>
        <h2 className="mt-4 font-serif text-4xl">{chosen.name}</h2>
        <p className="mt-3 text-stone-600">{chosen.description}</p>
        <h3 className="mt-8 font-semibold">What’s included</h3>
        <ul className="mt-4 grid gap-3">
          {journey.includes.map((x) => (
            <li key={x} className="flex gap-3 text-sm">
              <Check className="size-5 text-emerald-700" />
              {x}
            </li>
          ))}
        </ul>
      </div>
      <aside className="rounded-xl bg-stone-50 p-6">
        <p className="text-sm text-stone-500">Starting at</p>
        <p className="mt-2 text-3xl font-bold">{chosen.price}</p>
        <Link
          href={nextHref}
          className="mt-8 flex justify-center rounded-md bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Customize this package →
        </Link>
      </aside>
    </div>
  );
}
function Customize({
  journey,
  nextHref,
}: {
  journey: JourneyData;
  nextHref: string;
}) {
  return (
    <>
      <h2 className="font-serif text-4xl">Tell us what you need.</h2>
      <p className="mt-3 text-sm text-stone-600">
        These details prepare the scope. Sensitive or detailed intake is
        collected only after purchase.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {journey.customization.map((field, i) => (
          <label key={field} className="grid gap-2 text-sm font-semibold">
            {field}
            <input
              className="rounded-xl border px-4 py-3 font-normal"
              placeholder={i === 0 ? "Enter details" : "Optional"}
            />
          </label>
        ))}
      </div>
      <Link
        href={nextHref}
        className="mt-8 inline-flex rounded-md bg-emerald-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Review configuration →
      </Link>
    </>
  );
}
function Review({
  journey,
  chosen,
  nextHref,
}: {
  journey: JourneyData;
  chosen: JourneyData["packages"][number];
  nextHref: string;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_.55fr]">
      <div>
        <h2 className="font-serif text-4xl">Review and confirm.</h2>
        <p className="mt-3 text-sm text-stone-600">
          You can return to an earlier step before starting checkout.
        </p>
        <div className="mt-7 divide-y rounded-xl border">
          {journey.includes.map((x) => (
            <p key={x} className="flex gap-3 p-4 text-sm">
              <Check className="size-5 text-emerald-700" />
              {x}
            </p>
          ))}
        </div>
      </div>
      <aside className="rounded-xl bg-stone-50 p-6">
        <p className="text-xs uppercase text-stone-500">Selected package</p>
        <h3 className="mt-2 text-xl font-semibold">{chosen.name}</h3>
        <p className="mt-7 text-2xl font-bold">{chosen.price}</p>
        <Link
          href={nextHref}
          className="mt-7 flex justify-center rounded-md bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Proceed to checkout →
        </Link>
      </aside>
    </div>
  );
}
function Checkout({
  journey,
  chosen,
  slug,
}: {
  journey: JourneyData;
  chosen: JourneyData["packages"][number];
  slug: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <LockKeyhole className="mx-auto size-10 text-emerald-800" />
      <h2 className="mt-5 font-serif text-4xl">Continue to secure checkout.</h2>
      <p className="mt-4 text-sm leading-7 text-stone-600">
        Payment details are never entered on this journey preview. The canonical
        Offer Catalog verifies current pricing, availability, checkout
        requirements, and activation before creating a secure provider session.
      </p>
      <div className="mt-7 rounded-xl border bg-stone-50 p-5 text-left">
        <p className="text-xs uppercase text-stone-500">Selection</p>
        <div className="mt-2 flex justify-between">
          <strong>{chosen.name}</strong>
          <strong>{chosen.price}</strong>
        </div>
      </div>
      <Link
        href={`/packages?category=${encodeURIComponent(journey.category)}`}
        className="mt-7 inline-flex rounded-md bg-emerald-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Choose the live offer in Offer Catalog →
      </Link>
      <Link
        href={`/platform/${slug}/confirmation?package=${encodeURIComponent(chosen.name)}`}
        className="mt-4 block text-xs text-stone-500 underline"
      >
        Preview the post-purchase confirmation
      </Link>
    </div>
  );
}
function Confirmation({ journey }: { journey: JourneyData }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <CircleCheck className="mx-auto size-14 text-[#a56b19]" />
      <h2 className="mt-5 font-serif text-4xl">{journey.confirmationTitle}</h2>
      <p className="mt-4 text-sm leading-7 text-stone-600">
        After a successful purchase, your order, entitlement, activation
        progress, and next action remain connected. This preview does not
        represent a completed payment.
      </p>
      <div className="mt-7 rounded-xl bg-stone-50 p-6 text-left">
        <h3 className="font-semibold">What happens next?</h3>
        <ul className="mt-4 space-y-3">
          {[
            "We verify the order and selected scope.",
            "Your activation journey begins without duplicate work.",
            "You receive clear instructions for the next action.",
          ].map((x) => (
            <li key={x} className="flex gap-3 text-sm">
              <Check className="size-5 text-emerald-700" />
              {x}
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={journey.destination}
        className="mt-7 inline-flex rounded-md bg-emerald-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Open the workspace →
      </Link>
    </div>
  );
}
