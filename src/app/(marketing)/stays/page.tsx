import { PropertyCard } from "@/components/property/property-card";
import { featuredProperties } from "@/lib/properties";

export default function StaysPage() {
  return <main className="py-16"><div className="container-shell"><p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Available stays</p><h1 className="mt-4 font-serif text-5xl">Find your next Luxe Haven.</h1><div className="mt-10 grid gap-6 md:grid-cols-3">{featuredProperties.map((property) => <PropertyCard key={property.id} property={property} />)}</div></div></main>;
}
