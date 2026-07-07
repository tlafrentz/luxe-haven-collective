import { PageHero } from "@/components/marketing/page-hero";
import { PropertyCard } from "@/components/property/property-card";
import { featuredProperties } from "@/lib/properties";

export default function StaysPage() {
  return (
    <main>
      <PageHero eyebrow="Available Stays" title="Boutique homes for restful, well-designed travel." description="Explore a growing collection of thoughtfully prepared short-term rentals with elevated amenities, simple arrivals, and responsive hospitality." />
      <section className="py-20"><div className="container-shell grid gap-6 md:grid-cols-3">{featuredProperties.map((property) => <PropertyCard key={property.id} property={property} />)}</div></section>
    </main>
  );
}
