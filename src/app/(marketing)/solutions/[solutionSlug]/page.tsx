import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTASection } from "@/components/marketing/cta-section";
import { SolutionLanding } from "@/components/marketing/solution-landing";
import { solutionJourneys, type SolutionSlug } from "@/lib/solution-journeys";
import {
  findPublicJourney,
  publicJourneys,
} from "@/features/public-experience/journeys";

export function generateStaticParams() {
  return publicJourneys.map(({ slug }) => ({ solutionSlug: slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ solutionSlug: string }>;
}): Promise<Metadata> {
  const journey = findPublicJourney((await params).solutionSlug);
  return journey
    ? {
        title: `${journey.title} | Luxe Haven Collective`,
        description: journey.description,
      }
    : {};
}
export default async function SolutionPage({
  params,
}: {
  params: Promise<{ solutionSlug: string }>;
}) {
  const solutionSlug = (await params).solutionSlug;
  if (solutionSlug in solutionJourneys) {
    return <SolutionLanding slug={solutionSlug as SolutionSlug} />;
  }
  const journey = findPublicJourney(solutionSlug);
  if (!journey) notFound();
  return (
    <main>
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-20 md:py-28">
        <div className="container-shell grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.24em] text-[#9a6d0b]">
              {journey.eyebrow}
            </p>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[1.04] md:text-7xl">
              {journey.title}
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-[#59635d]">
              {journey.promise}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/packages?category=${journey.offerCategory}`}
                className="rounded-md bg-[#074e38] px-6 py-3.5 text-sm font-semibold text-white"
              >
                {journey.cta}
              </Link>
              <Link
                href="/get-started"
                className="rounded-md border border-[#7f8a84] bg-white px-6 py-3.5 text-sm font-semibold"
              >
                Find my best fit
              </Link>
            </div>
          </div>
          <aside className="rounded-[2rem] border border-[#d6ddd8] bg-white p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#087251]">
              Primary capability
            </p>
            <h2 className="mt-3 font-serif text-4xl">{journey.capability}</h2>
            <ul className="mt-7 grid gap-3 text-sm text-[#4f5953]">
              {journey.supporting.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
      <section className="py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#a67610]">
              The challenge
            </p>
            <h2 className="mt-4 font-serif text-4xl">
              A better system starts with the real problem.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#5f6963]">
              {journey.problem}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#087251]">
              What changes
            </p>
            <ul className="mt-5 grid gap-4">
              {journey.outcomes.map((outcome) => (
                <li
                  key={outcome}
                  className="rounded-2xl border border-[#dce2dd] bg-[#f8faf8] p-5 font-semibold"
                >
                  ✓ {outcome}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="bg-[#0b3f31] py-20 text-white">
        <div className="container-shell">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b75d]">
            How it works
          </p>
          <h2 className="mt-4 font-serif text-4xl">
            A clear path to the first useful outcome.
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {journey.steps.map((step, index) => (
              <li
                key={step}
                className="rounded-2xl border border-white/15 bg-white/5 p-6"
              >
                <span className="text-sm text-[#d8b75d]">0{index + 1}</span>
                <p className="mt-4 font-semibold">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CTASection
        title="Choose the path that fits your needs."
        description="Review published packages or answer a few questions for a guided recommendation."
        primaryHref={`/packages?category=${journey.offerCategory}`}
        primaryLabel="View packages"
        secondaryHref="/get-started"
        secondaryLabel="Get a recommendation"
      />
    </main>
  );
}
