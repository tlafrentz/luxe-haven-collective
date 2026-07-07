import { Card } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

const values = [
  ["Guest-first design", "Every touchpoint is shaped around easy arrivals, restful stays, thoughtful amenities, and consistent five-star expectations."],
  ["Revenue discipline", "Pricing, positioning, occupancy, ADR, and guest demand are reviewed together so owners make decisions from a clear performance picture."],
  ["Operational polish", "Housekeeping standards, maintenance triage, owner updates, and guest communication are treated as one connected hospitality system."]
];

export function ValueProps() {
  return (
    <section className="py-20">
      <div className="container-shell">
        <SectionHeading eyebrow="Why Luxe Haven" title="Premium hospitality without the fragmented operations." description="We combine boutique brand standards with the systems needed to manage modern short-term rentals professionally." />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {values.map(([title, description]) => (
            <Card key={title} className="p-7">
              <div className="mb-8 h-12 w-12 rounded-full bg-accent/15" />
              <h3 className="font-serif text-2xl">{title}</h3>
              <p className="mt-4 leading-7 text-muted-foreground">{description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
