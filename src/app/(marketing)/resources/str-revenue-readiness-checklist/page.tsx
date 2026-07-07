import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";

const sections = [
  {
    title: "Listing conversion",
    checks: ["Headline clearly names the guest promise", "Photos are bright, complete, and ordered by guest decision points", "Description answers who the stay is best for and why it is worth booking"]
  },
  {
    title: "Guest experience",
    checks: ["Beds, linens, lighting, and essentials meet premium-stay expectations", "House rules and check-in instructions are simple and clear", "Amenities match the market and target guest profile"]
  },
  {
    title: "Revenue readiness",
    checks: ["Base pricing, weekend premiums, and seasonal demand are reviewed regularly", "Minimum nights and discounts support occupancy without eroding value", "Owner reporting shows revenue, occupancy, ADR, and next actions"]
  },
  {
    title: "Operations",
    checks: ["Cleaning standards are documented", "Maintenance issues have a clear intake and resolution process", "Guest messages are answered quickly and consistently"]
  }
];

export default function ChecklistPage() {
  return (
    <main>
      <PageHero eyebrow="Owner Resource" title="STR Revenue Readiness Checklist" description="Use this working checklist to evaluate listing quality, guest readiness, revenue discipline, and operating standards before your next booking window." />
      <section className="py-20">
        <div className="container-shell grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="rounded-[2rem] border border-border bg-card p-7">
              <h2 className="font-serif text-3xl">{section.title}</h2>
              <div className="mt-6 grid gap-3">
                {section.checks.map((check) => (
                  <p key={check} className="rounded-2xl bg-muted/60 p-4 text-sm leading-6">□ {check}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-muted/45 py-16">
        <div className="container-shell text-center">
          <h2 className="font-serif text-4xl">Want this prioritized for your property?</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-8 text-muted-foreground">Send us your property market, current listing status, and biggest revenue question. Luxe Haven can help identify the highest-impact next improvements.</p>
          <Link href="/contact" className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Request a Property Review</Link>
        </div>
      </section>
    </main>
  );
}
