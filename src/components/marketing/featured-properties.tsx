import Link from "next/link";
import { featuredProperties } from "@/lib/properties";
import { PropertyCard } from "@/components/property/property-card";
import { SectionHeading } from "./section-heading";

export function FeaturedProperties() {
  return (
    <section className="py-20">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Featured stays" title="Curated homes designed for comfort, beauty, and ease." />
          <Link href="/stays" className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">View all stays →</Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {featuredProperties.map((property) => <PropertyCard key={property.id} property={property} />)}
        </div>
      </div>
    </section>
  );
}
