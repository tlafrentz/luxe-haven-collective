import Link from "next/link";
import { CTASection } from "@/components/marketing/cta-section";
import { PageHero } from "@/components/marketing/page-hero";

const checks = ["Is my listing positioned for the highest-value guest?", "Are my amenities and house standards review-worthy?", "Is my pricing strategy aligned with demand and seasonality?", "Do I have a repeatable operations system?", "Can I clearly see revenue, occupancy, and next actions each month?"];

export default function OwnersPage() {
  return (
    <main>
      <PageHero eyebrow="For Owners" title="Turn your property into a better-performing hospitality asset." description="Luxe Haven helps owners improve the guest experience, protect quality, and make smarter revenue decisions without managing every detail alone." />
      <section className="py-20"><div className="container-shell grid gap-12 lg:grid-cols-[1fr_.9fr] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Owner readiness</p><h2 className="mt-4 font-serif text-5xl leading-tight">The properties that win are the ones that feel intentional.</h2><p className="mt-5 leading-8 text-muted-foreground">Travelers have more choices than ever. Owners need more than a clean space and a booking calendar. They need a sharp listing, consistent standards, rapid communication, revenue discipline, and a clear plan for improvement.</p><Link href="/lead-magnet" className="mt-8 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Get the Owner Checklist</Link></div><div className="rounded-[2rem] border border-border bg-card p-7">{checks.map((check) => <div key={check} className="border-b border-border py-4 last:border-0"><p className="font-medium">✓ {check}</p></div>)}</div></div></section>
      <section className="bg-muted/45 py-20"><div className="container-shell grid gap-5 md:grid-cols-3">{[["Audit", "Review listing, positioning, guest journey, pricing, and operational gaps."], ["Roadmap", "Prioritize high-impact improvements across guest experience and revenue."], ["Operate", "Build a management rhythm owners can see, trust, and scale."]].map(([title, copy]) => <div key={title} className="rounded-3xl bg-card p-7"><h3 className="font-serif text-3xl">{title}</h3><p className="mt-4 leading-7 text-muted-foreground">{copy}</p></div>)}</div></section>
      <CTASection />
    </main>
  );
}
