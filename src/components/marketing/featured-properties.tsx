import { featuredProperties } from "@/lib/properties";
import { PropertyCard } from "@/components/property/property-card";

export function FeaturedProperties() {
  return (
    <section className="py-20">
      <div className="container-shell">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Featured stays</p><h2 className="mt-3 font-serif text-4xl md:text-5xl">Guest-ready homes with boutique polish.</h2></div><p className="max-w-lg text-muted-foreground">Each property is positioned for comfort, clean operations, and a memorable stay from inquiry to checkout.</p></div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">{featuredProperties.map((property) => <PropertyCard key={property.id} property={property} />)}</div>
      </div>
    </section>
  );
}
