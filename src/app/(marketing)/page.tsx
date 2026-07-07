import { CTASection } from "@/components/marketing/cta-section";
import { FeaturedProperties } from "@/components/marketing/featured-properties";
import { HeroSection } from "@/components/marketing/hero-section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ValueProps } from "@/components/marketing/value-props";

const services = [
  "Listing positioning and conversion copy",
  "Guest communication and experience design",
  "Revenue review and pricing recommendations",
  "Housekeeping standards and turnover quality",
  "Owner reporting and property performance insights",
  "Maintenance coordination and vendor workflows"
];

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <FeaturedProperties />
      <ValueProps />
      <section className="bg-muted/45 py-20">
        <div className="container-shell grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <SectionHeading eyebrow="Owner services" title="A boutique management layer for owners who care about the details." description="Luxe Haven is built for properties that deserve more than basic hosting. We help owners create a stay experience guests remember and an operating model that is easier to trust." />
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service) => <div key={service} className="rounded-3xl border border-border bg-card p-5 text-sm font-medium">{service}</div>)}
          </div>
        </div>
      </section>
      <section className="py-20">
        <div className="container-shell grid gap-8 md:grid-cols-3">
          {[["01", "Position", "We sharpen the promise of the property so the right guests understand the value quickly."], ["02", "Prepare", "We align amenities, house standards, check-in flow, and guest support around a premium stay."], ["03", "Perform", "We review revenue, reviews, operations, and owner goals so each month has a clear plan."]].map(([number, title, copy]) => (
            <div key={number} className="border-t border-border pt-6">
              <p className="text-sm font-semibold text-accent">{number}</p>
              <h3 className="mt-4 font-serif text-3xl">{title}</h3>
              <p className="mt-4 leading-7 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>
      <CTASection />
    </main>
  );
}
