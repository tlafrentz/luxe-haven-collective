import Link from "next/link";

import { getPublishedProperties } from "@/lib/properties";
import { PropertyCard } from "@/components/property/property-card";
import { SectionHeading } from "./section-heading";

export async function FeaturedProperties() {
  const properties = (await getPublishedProperties()).slice(0, 3);

  return (
    <section className="py-20 md:py-28">
      <div className="container-shell">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <SectionHeading
            eyebrow="The standard in practice"
            title="Thoughtful homes designed around comfort, confidence, and ease."
            description="Our properties demonstrate how clear positioning, considered design, and operational discipline come together in the guest experience."
          />

          <div className="lg:justify-self-end">
            <Link
              href="/stays"
              className="text-sm font-semibold uppercase tracking-[0.18em] text-accent"
            >
              Explore Our Properties →
            </Link>
          </div>
        </div>

        {properties.length ? (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-[2rem] border border-border bg-card p-8 text-muted-foreground">
            Published properties will appear here once they are available
            through the Luxe Haven property portfolio.
          </div>
        )}
      </div>
    </section>
  );
}
