import { CTASection } from "@/components/marketing/cta-section";
import { PageHero } from "@/components/marketing/page-hero";

const faqs = [
  ["Do you manage properties directly?", "The platform is designed to support full-service and consulting-style STR management, including guest experience, listing optimization, owner reporting, and operations workflows."],
  ["Can guests book directly?", "The current marketing foundation is prepared for direct booking. The booking engine, payments, and availability logic are planned for the next product milestones."],
  ["What type of properties are a fit?", "Homes that can support a boutique guest experience: clean design, strong location, reliable operations, and owners who value quality and performance."],
  ["Do you help with listing copy and optimization?", "Yes. Listing positioning, descriptions, amenities, photos, and conversion flow are core parts of the Luxe Haven strategy."],
  ["Is there an owner portal?", "The Sprint 2 foundation includes an owner portal shell. Future sprints will connect property performance, bookings, revenue reporting, documents, and maintenance updates."],
  ["Can Luxe Haven help a new STR launch?", "Yes. Launch consulting can cover readiness, positioning, guest journey, amenity setup, house manual, pricing basics, and operating workflows."]
];

export default function FAQPage() {
  return (
    <main>
      <PageHero eyebrow="FAQ" title="Answers for guests, owners, and future partners." description="A quick overview of how Luxe Haven Collective is structured and where the platform is headed." />
      <section className="py-20"><div className="container-shell max-w-4xl divide-y divide-border rounded-[2rem] border border-border bg-card px-6 md:px-10">{faqs.map(([q, a]) => <div key={q} className="py-7"><h2 className="font-serif text-2xl">{q}</h2><p className="mt-3 leading-7 text-muted-foreground">{a}</p></div>)}</div></section>
      <CTASection />
    </main>
  );
}
