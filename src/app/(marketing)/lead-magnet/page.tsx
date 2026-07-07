import Link from "next/link";
import { LeadMagnetForm } from "@/components/forms/lead-magnet-form";
import { PageHero } from "@/components/marketing/page-hero";

const items = ["Listing conversion and positioning", "Guest experience and amenity gaps", "Pricing and occupancy opportunities", "Operations, turnovers, and maintenance rhythm", "Owner reporting and next-action clarity"];

export default function LeadMagnetPage() {
  return (
    <main>
      <PageHero eyebrow="Free Owner Tool" title="Download the Short-Term Rental Revenue Readiness Checklist." description="A practical owner-facing framework to evaluate whether your property is ready to earn stronger bookings, better reviews, and more consistent performance." />
      <section className="py-20"><div className="container-shell grid gap-10 lg:grid-cols-[1fr_.9fr]"><div className="rounded-[2rem] border border-border bg-card p-8"><p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">Inside the checklist</p><h2 className="mt-4 font-serif text-4xl">See what is helping or hurting your property before the next guest ever books.</h2><div className="mt-8 grid gap-4">{items.map((item) => <p key={item} className="rounded-2xl bg-muted/60 p-4 font-medium">✓ {item}</p>)}</div></div><LeadMagnetForm /></div></section>
      <section className="bg-muted/45 py-16"><div className="container-shell text-center"><h2 className="font-serif text-4xl">Prefer a guided review?</h2><p className="mx-auto mt-4 max-w-2xl leading-8 text-muted-foreground">Use the checklist first, then schedule a consultation to prioritize improvements with Luxe Haven.</p><Link href="/contact" className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Schedule a Consultation</Link></div></section>
    </main>
  );
}
