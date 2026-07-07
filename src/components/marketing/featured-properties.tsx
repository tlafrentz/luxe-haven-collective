import Link from "next/link";
import { getPublishedProperties } from "@/lib/properties";
import { PropertyCard } from "@/components/property/property-card";
import { SectionHeading } from "./section-heading";

export async function FeaturedProperties() {
  const properties = (await getPublishedProperties()).slice(0, 3);
  return (
    <section className="py-20">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Featured stays" title="Curated homes designed for comfort, beauty, and ease." />
          <Link href="/stays" className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">View all stays →</Link>
        </div>
        {properties.length ? <div className="mt-10 grid gap-6 md:grid-cols-3">{properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div> : <div className="mt-10 rounded-[2rem] border border-border bg-card p-8 text-muted-foreground">Published stays will appear here once properties are added in the admin dashboard.</div>}
      </div>
    </section>
  );
}
