import { PropertyCard } from "@/components/property/property-card";
import { featuredProperties } from "@/lib/properties";

export default function OwnerPropertiesPage() {
  return <section><h1 className="font-serif text-5xl">Managed properties</h1><div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{featuredProperties.map((property) => <PropertyCard key={property.id} property={property} />)}</div></section>;
}
