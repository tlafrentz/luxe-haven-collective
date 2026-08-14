import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Eye,
  Heart,
  Lightbulb,
  Play,
  UserRound,
} from "lucide-react";
import { HomepageLink } from "@/components/marketing/homepage-link";
import { SafeImage } from "@/components/shared/safe-image";
import { getSessionProfile } from "@/lib/auth/session";
import { insightsCards } from "@/lib/insights";

const description =
  "Hospitality Performance Management for independent hospitality owners—connecting performance, guest experience, execution, and learning in one place.";

export const metadata: Metadata = {
  title: "Hospitality Performance Management",
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Luxe Haven Collective | Hospitality Performance Management",
    description,
    url: "/",
    type: "website",
    images: [
      {
        url: "/images/journal/stop-guessing-use-data-to-make-better-decisions/decision-intelligence-og.png",
        width: 1200,
        height: 630,
        alt: "Luxe Haven Collective hospitality performance management",
      },
    ],
  },
};

const pathways = [
  {
    name: "HPM",
    copy: "Run your operations with clarity so decisions are easier and results improve.",
    action: "Explore HPM",
    href: "/hpm",
    id: "pathway_hpm",
    image: "/images/journal/stop-guessing-use-data-to-make-better-decisions/decision-intelligence-hero.jpg",
    alt: "Hospitality performance information in an operator workspace",
    icon: Eye,
  },
  {
    name: "Guidebook Studio",
    copy: "Design exceptional stays with proven playbooks and operational excellence.",
    action: "Explore Guidebook",
    href: "/guidebook-studio",
    id: "pathway_guidebook",
    image: "/images/journal/your-guidebook-is-your-silent-guest-service-team/guidebook-hero.jpg",
    alt: "Guest guidebook prepared for a hospitality stay",
    icon: BookOpen,
  },
  {
    name: "Furnishing",
    copy: "Create spaces that feel elevated, photograph beautifully, and last longer.",
    action: "Explore Furnishing",
    href: "/furnishing",
    id: "pathway_furnishing",
    image: "/images/journal/the-small-touches-that-drive-5-star-reviews/small-touches-hero.jpg",
    alt: "Warm modern hospitality interior with considered details",
    icon: Heart,
  },
  {
    name: "Investment Intelligence",
    copy: "Evaluate opportunities and assets with better context and fewer unknowns.",
    action: "Explore Intelligence",
    href: "/investment-intelligence",
    id: "pathway_investment",
    image: "/images/journal/what-investors-look-for-in-short-term-rentals/investor-hero.jpg",
    alt: "Hospitality property evaluated as an investment opportunity",
    icon: BarChart3,
  },
] as const;

const lifecycle = [
  ["See", "Capture what matters.", Eye],
  ["Understand", "Interpret insights with context.", BarChart3],
  ["Decide", "Prioritize actions with confidence.", CheckCircle2],
  ["Execute", "Put plans into focused motion.", Play],
  ["Learn", "Measure outcomes and adapt.", BookOpen],
] as const;

const publishedResources = [
  {
    type: "Owner Playbooks",
    title: "Owner Performance Checklist",
    description: "A practical framework for sharper hospitality operations.",
    image: "/images/journal/turnover-checklists-that-protect-quality/quality-gates.svg",
    href: "/resources/playbooks",
    action: "Explore",
    id: "resource_owner_playbooks",
  },
  {
    type: "Insights",
    title: insightsCards[2]?.title ?? "Hospitality performance insights",
    description: insightsCards[2]?.description ?? "Timely perspectives on what shapes results.",
    image:
      insightsCards[2]?.image ??
      "/images/journal/stop-guessing-use-data-to-make-better-decisions/decision-intelligence-hero-v2.png",
    href: insightsCards[2]?.href ?? "/resources/insights",
    action: "Read insights",
    id: "resource_insights",
  },
  {
    type: "Templates & Checklists",
    title: "Ready-to-use hospitality resources",
    description: "Save time with practical tools built for consistent execution.",
    image: "/images/journal/automation-that-saves-time-and-protects-reviews/automation-checklist.svg",
    href: "/resources/templates",
    action: "Browse tools",
    id: "resource_templates",
  },
] as const;

export default async function HomePage() {
  const { user } = await getSessionProfile();
  const authenticated = Boolean(user);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luxehavencollective.co";
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Luxe Haven Collective",
    url: siteUrl,
    description,
  };

  return (
    <main className="overflow-x-clip bg-[#fbf8f1] text-[#102f28]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replaceAll("<", "\\u003c") }}
      />

      <section aria-labelledby="home-title" className="border-b border-[#d9d2c5]">
        <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[42%_58%]">
          <div className="min-w-0 overflow-hidden px-6 py-14 sm:px-10 lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-20 xl:px-16">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#996a1c]">
              Hospitality Performance Management
            </p>
            <h1 id="home-title" className="mt-6 font-serif text-[clamp(2.7rem,6vw,5.9rem)] leading-[.94] tracking-[-.045em] sm:text-[clamp(3.35rem,6vw,5.9rem)]">
              <span className="block">See clearly.</span>
              <span className="block">Decide confidently.</span>
              <span className="block">Perform better.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#3f4d48]">
              An intelligent operating system for independent hospitality owners—connecting performance, guest experience, execution, and learning in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <HomepageLink actionId="hero_explore_hpm" sourceSection="hero" authenticated={authenticated} href="/hpm" className="inline-flex min-h-11 items-center gap-3 rounded-sm bg-[#073f32] px-6 text-sm font-semibold text-white transition hover:bg-[#052f26] focus-visible:outline-2 focus-visible:outline-offset-2">
                Explore HPM <ArrowRight className="size-4" />
              </HomepageLink>
              <HomepageLink actionId="hero_find_best_fit" sourceSection="hero" authenticated={authenticated} href="/get-started" className="inline-flex min-h-11 items-center gap-3 rounded-sm border border-[#668078] bg-white/60 px-6 text-sm font-semibold transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2">
                Find Your Best Fit
              </HomepageLink>
            </div>
          </div>
          <div className="relative min-h-[420px] lg:min-h-[620px]">
            <SafeImage src="/images/journal/the-small-touches-that-drive-5-star-reviews/small-touches-hero.jpg" alt="Warm modern Luxe Haven hospitality interior prepared for guests" fill priority sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" />
            <ol aria-label="Hospitality Performance Management lifecycle" className="absolute inset-x-4 bottom-4 grid grid-cols-5 rounded-md border border-white/70 bg-[#fbfaf7]/95 px-3 py-4 text-center shadow-xl backdrop-blur sm:inset-x-8 lg:-bottom-5">
              {lifecycle.map(([name, , Icon], index) => (
                <li key={name} className="flex min-w-0 items-center justify-center gap-1.5 text-[10px] font-semibold text-[#183d34] sm:text-xs">
                  <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
                  <span>{name}</span>{index < lifecycle.length - 1 ? <span className="ml-1 text-[#9b7a3c]" aria-hidden>·</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="pathways-title" className="px-6 py-16 sm:px-10 lg:py-20">
        <div className="mx-auto max-w-[1340px]">
          <h2 id="pathways-title" className="text-center font-serif text-4xl leading-tight md:text-5xl">
            One connected system.<span className="block italic">Four ways to move forward.</span>
          </h2>
          <div className="mt-10 grid gap-7 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0">
            {pathways.map((pathway) => (
              <article key={pathway.name} className="group relative px-0 xl:border-r xl:border-[#d7d0c5] xl:px-5 xl:first:pl-0 xl:last:border-r-0 xl:last:pr-0">
                <div className="relative aspect-[1.38/1] overflow-hidden rounded-md">
                  <SafeImage src={pathway.image} alt={pathway.alt} fill sizes="(min-width:1280px) 25vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.02] motion-reduce:transition-none" />
                  <span className="absolute left-0 top-0 grid size-12 place-items-center rounded-br-full bg-[#0b4b3c] text-white"><pathway.icon className="size-5" aria-hidden /></span>
                </div>
                <h3 className="mt-5 font-serif text-2xl">{pathway.name}</h3>
                <p className="mt-2 min-h-16 text-sm leading-6 text-[#4d5752]">{pathway.copy}</p>
                <HomepageLink actionId={pathway.id} sourceSection="product_pathways" authenticated={authenticated} href={pathway.href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#074437] underline-offset-4 hover:underline">
                  {pathway.action} <ArrowRight className="size-4" />
                </HomepageLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="lifecycle-title" className="bg-[#064638] px-6 py-12 text-white sm:px-10 lg:py-14">
        <div className="mx-auto max-w-[1200px]">
          <h2 id="lifecycle-title" className="text-center font-serif text-3xl md:text-4xl">From insight to measurable improvement.</h2>
          <ol className="relative mt-9 grid gap-7 sm:grid-cols-5 sm:gap-3">
            <span aria-hidden className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-[#b99141] sm:block" />
            {lifecycle.map(([name, copy, Icon]) => (
              <li key={name} className="relative grid grid-cols-[56px_1fr] items-center gap-4 sm:block sm:text-center">
                <span className="relative z-10 grid size-14 place-items-center rounded-full border border-[#d2a747] bg-[#064638]"><Icon className="size-6" aria-hidden /></span>
                <div className="sm:mt-4"><h3 className="font-serif text-xl">{name}</h3><p className="mt-1 text-xs leading-5 text-white/80">{copy}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="operator-title" className="grid border-b border-[#d9d2c5] lg:grid-cols-2">
        <div className="relative min-h-[380px] lg:min-h-[560px]">
          <SafeImage src="/images/journal/turnover-checklists-that-protect-quality/turnover-hero.jpg" alt="Guest-ready hospitality interior reflecting real operating standards" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
        </div>
        <div className="flex items-center px-6 py-14 sm:px-12 lg:px-16">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#996a1c]">Operator Built</p>
            <h2 id="operator-title" className="mt-4 font-serif text-4xl leading-[1.05] md:text-5xl">Designed around the realities of hospitality.</h2>
            <p className="mt-6 text-base leading-7 text-[#46534e]">Luxe Haven connects clearer information, thoughtful guest experiences, and disciplined execution—because better performance depends on all three.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {[["Real operating context",UserRound],["Guest-centered standards",Heart],["Decisions connected to action",Lightbulb]].map(([label, Icon]) => {
                const Mark=Icon as typeof UserRound; return <li key={String(label)} className="flex items-center gap-3 text-xs font-semibold"><span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#6d8980]"><Mark className="size-4" aria-hidden /></span>{String(label)}</li>;
              })}
            </ul>
            <HomepageLink actionId="operator_our_approach" sourceSection="operator_built" authenticated={authenticated} href="/approach" className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-sm bg-[#073f32] px-6 text-sm font-semibold text-white">
              Our Approach <ArrowRight className="size-4" />
            </HomepageLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="resources-title" className="px-6 py-14 sm:px-10 lg:py-16">
        <div className="mx-auto max-w-[1340px]">
          <h2 id="resources-title" className="text-center font-serif text-3xl md:text-4xl">Practical intelligence for better hospitality decisions.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {publishedResources.map((resource) => (
              <article key={resource.id} className="grid min-h-40 grid-cols-[38%_1fr] overflow-hidden rounded-md border border-[#ded8cd] bg-white/60">
                <div className="relative"><SafeImage src={resource.image} alt="" fill sizes="(min-width:768px) 14vw, 38vw" className="object-cover" /></div>
                <div className="p-5"><p className="font-serif text-xl">{resource.type}</p><h3 className="sr-only">{resource.title}</h3><p className="mt-2 text-xs leading-5 text-[#56605b]">{resource.description}</p><HomepageLink actionId={resource.id} sourceSection="resources" authenticated={authenticated} href={resource.href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#074437]">{resource.action} <ArrowRight className="size-3" /></HomepageLink></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="final-cta-title" className="bg-[#064638] px-6 py-12 text-white sm:px-10">
        <div className="mx-auto grid max-w-[1260px] items-center gap-8 lg:grid-cols-[1fr_1fr_auto]">
          <h2 id="final-cta-title" className="font-serif text-4xl leading-tight md:text-5xl">What could perform better next?</h2>
          <p className="border-[#b99141] text-sm leading-6 text-white/85 lg:border-l lg:pl-8">Let’s identify the clearest opportunities to strengthen your property, guest experience, operations, and performance.</p>
          <div className="grid gap-3">
            <HomepageLink actionId="final_start_conversation" sourceSection="final_cta" authenticated={authenticated} href="/contact" className="inline-flex min-h-11 items-center justify-between gap-8 rounded-sm border border-[#c49b42] px-6 text-sm font-semibold text-[#f3c968]">Start the Conversation <ArrowRight className="size-4" /></HomepageLink>
            <HomepageLink actionId="final_explore_platform" sourceSection="final_cta" authenticated={authenticated} href="/hpm" className="inline-flex min-h-11 items-center justify-between gap-8 rounded-sm border border-white/70 px-6 text-sm font-semibold">Explore the Platform <ArrowRight className="size-4" /></HomepageLink>
          </div>
        </div>
      </section>
    </main>
  );
}
