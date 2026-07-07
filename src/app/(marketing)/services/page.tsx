import { CTASection } from "@/components/marketing/cta-section";
import { PageHero } from "@/components/marketing/page-hero";

const services = [
  ["Full-Service STR Management", "Guest messaging, calendar oversight, turnovers, issue triage, vendor coordination, owner updates, and hospitality standards."],
  ["Listing Optimization", "Conversion-focused headlines, descriptions, amenity positioning, photo sequencing, and market-aware copy designed to increase trust."],
  ["Revenue Strategy", "Pricing reviews, seasonal strategy, occupancy analysis, minimum-stay recommendations, and owner performance summaries."],
  ["Guest Experience Design", "Pre-arrival flows, check-in instructions, local recommendations, welcome touches, and review-driving details."],
  ["Owner Reporting", "Monthly performance snapshots covering revenue, occupancy, ADR, reviews, maintenance, and recommended next actions."],
  ["Launch Consulting", "A structured setup for new STR owners who need help moving from furnished property to bookable hospitality asset."]
];

export default function ServicesPage() {
  return (
    <main>
      <PageHero eyebrow="Services" title="Everything your property needs to perform like a boutique hospitality brand." description="Choose support across launch, optimization, guest experience, revenue, and ongoing operations." />
      <section className="py-20"><div className="container-shell grid gap-6 md:grid-cols-2 lg:grid-cols-3">{services.map(([title, copy]) => <article key={title} className="rounded-[2rem] border border-border bg-card p-7"><p className="mb-8 h-10 w-10 rounded-full bg-accent/15"/><h2 className="font-serif text-3xl">{title}</h2><p className="mt-4 leading-7 text-muted-foreground">{copy}</p></article>)}</div></section>
      <section className="bg-muted/45 py-20"><div className="container-shell max-w-4xl text-center"><p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Engagement options</p><h2 className="mt-4 font-serif text-5xl">Built for different stages of ownership.</h2><p className="mx-auto mt-5 max-w-2xl leading-8 text-muted-foreground">Whether you need a launch roadmap, a listing refresh, or an ongoing management partner, Luxe Haven is structured to meet owners where they are and raise the standard from there.</p></div></section>
      <CTASection />
    </main>
  );
}
