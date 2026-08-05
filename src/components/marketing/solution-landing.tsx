import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
  Star,
} from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";
import { platformJourneys } from "@/lib/platform-journeys";
import { solutionJourneys, type SolutionSlug } from "@/lib/solution-journeys";
import { SolutionsNavigation } from "./solutions-navigation";

export function SolutionLanding({ slug }: { slug: SolutionSlug }) {
  const solution = solutionJourneys[slug];
  const journey = platformJourneys[solution.journey];
  const start = `/platform/${solution.journey}/select-package`;
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b">
        <div className="container-shell grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="py-14 lg:py-20">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              {solution.eyebrow}
            </p>
            <h1 className="mt-5 max-w-2xl font-serif text-5xl leading-[1.07] md:text-6xl">
              {solution.title}
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-stone-600">
              {solution.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={start}
                className="rounded-md bg-emerald-900 px-6 py-3 text-sm font-semibold text-white"
              >
                {solution.packageLabel} →
              </Link>
              <Link
                href={`/platform/${solution.journey}/journey`}
                className="rounded-md border px-6 py-3 text-sm font-semibold"
              >
                How it works →
              </Link>
            </div>
          </div>
          <div className="relative min-h-[380px]">
            <SafeImage
              src={
                mesaAirbnbImages[
                  slug === "investment"
                    ? 4
                    : slug === "property-launch"
                      ? 2
                      : slug === "operations"
                        ? 3
                        : 1
                ]
              }
              alt=""
              fill
              priority
              className="object-cover"
              sizes="50vw"
            />
          </div>
        </div>
      </section>
      <SolutionsNavigation active={solution.eyebrow} />
      <section className="py-12">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
            What you’ll achieve
          </p>
          <div className="mt-7 grid gap-5 md:grid-cols-4">
            {solution.outcomes.map((x, i) => {
              const icons = [Star, Clock3, ShieldCheck, CircleDollarSign];
              const Icon = icons[i];
              return (
                <div key={x} className="text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-full border text-[#a56b19]">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="mt-4 font-semibold">{x}</h2>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="pb-14">
        <div className="container-shell">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
                Popular packages
              </p>
              <h2 className="mt-3 font-serif text-4xl">
                Choose a clear path forward.
              </h2>
            </div>
            <Link
              href={start}
              className="text-sm font-semibold text-emerald-800"
            >
              View all packages →
            </Link>
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {journey.packages.map((p) => (
              <article
                key={p.name}
                className="overflow-hidden rounded-xl border bg-white"
              >
                <div className="relative aspect-[1.65/1]">
                  <SafeImage
                    src={
                      mesaAirbnbImages[
                        journey.packages.indexOf(p) % mesaAirbnbImages.length
                      ]
                    }
                    alt=""
                    fill
                    className="object-cover"
                    sizes="33vw"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-2xl">{p.name}</h3>
                  <p className="mt-2 text-xl font-bold">{p.price}</p>
                  <p className="mt-3 text-sm text-stone-600">{p.description}</p>
                  <Link
                    href={`/platform/${solution.journey}/package-details?package=${encodeURIComponent(p.name)}`}
                    className="mt-6 inline-flex text-sm font-semibold text-emerald-800"
                  >
                    Learn more →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="pb-14">
        <div className="container-shell grid overflow-hidden rounded-xl bg-emerald-950 text-white lg:grid-cols-[1fr_.35fr]">
          <div className="p-8">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d6a04c]">
              Your next step
            </p>
            <h2 className="mt-3 font-serif text-3xl">{solution.nextTitle}</h2>
            <p className="mt-2 text-sm text-white/70">
              Compare packages or use our guided recommendation.
            </p>
            <Link
              href={start}
              className="mt-6 inline-flex rounded-md bg-white px-5 py-3 text-sm font-semibold text-emerald-950"
            >
              Find My Best Fit →
            </Link>
          </div>
          <div className="relative min-h-[210px]">
            <SafeImage
              src={mesaAirbnbImages[0]}
              alt=""
              fill
              className="object-cover"
              sizes="35vw"
            />
          </div>
        </div>
      </section>
      <section className="pb-14">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
            Your journey
          </p>
          <h2 className="mt-3 font-serif text-3xl">
            From selection to activation in clear steps.
          </h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Select package",
              "Package details",
              "Customize",
              "Review order",
              "Secure checkout",
              "Confirmation",
              "Activation",
              "Your workspace",
            ].map((x, i) => (
              <Link
                key={x}
                href={`/platform/${solution.journey}/${i === 0 ? "select-package" : i === 1 ? "package-details" : i === 2 ? "customize" : i === 3 ? "review" : i === 4 ? "checkout" : "confirmation"}`}
                className="rounded-xl border bg-white p-4"
              >
                <span className="text-xs text-[#a56b19]">0{i + 1}</span>
                <p className="mt-2 flex items-center justify-between font-semibold">
                  {x}
                  <ArrowRight className="size-4" />
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {journey.includes.slice(0, 3).map((x) => (
              <p key={x} className="flex gap-2 text-sm text-stone-600">
                <Check className="size-5 text-emerald-700" />
                {x}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
