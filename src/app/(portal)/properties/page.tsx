import { PropertyCard } from "@/components/property/property-card";
import { getPublishedProperties } from "@/lib/properties";

export default async function PortalPropertiesPage() {
  const properties = await getPublishedProperties();
  return <section><h1 className="font-serif text-5xl">Managed properties</h1><p className="mt-3 text-white/60">Owner-specific property access will use the owner assignment table as accounts are onboarded.</p><div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div></section>;
}
