import Link from "next/link";
import { CTASection } from "@/components/marketing/cta-section";
import { PageHero } from "@/components/marketing/page-hero";

const resources = [
  ["Owner Revenue Checklist", "A practical guide to spot listing, pricing, and experience gaps before they cost bookings.", "/lead-magnet"],
  ["Guest Experience Audit", "Review the arrival, stay, and checkout moments that influence reviews and repeat demand.", "/contact"],
  ["Listing Optimization Guide", "Improve your headline, opening description, amenities, and photo flow with hospitality-first copy.", "/services"]
];

export default function ResourcesPage() {
  return (
    <main>
      <PageHero eyebrow="Resources" title="Guides and insights for better short-term rental performance." description="Start with practical frameworks for improving conversion, guest satisfaction, and owner clarity." />
      <section className="py-20"><div className="container-shell grid gap-6 md:grid-cols-3">{resources.map(([title, copy, href]) => <Link key={title} href={href} className="rounded-[2rem] border border-border bg-card p-7 transition hover:-translate-y-1 hover:shadow-xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Resource</p><h2 className="mt-5 font-serif text-3xl">{title}</h2><p className="mt-4 leading-7 text-muted-foreground">{copy}</p><p className="mt-8 text-sm font-semibold">Explore →</p></Link>)}</div></section>
      <CTASection title="Want the owner checklist first?" description="Download the framework and use it to evaluate your property before your next pricing or listing update." />
    </main>
  );
}
