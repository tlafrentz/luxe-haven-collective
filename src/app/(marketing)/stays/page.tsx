import { PageHero } from "@/components/marketing/page-hero";
import { PropertyCard } from "@/components/property/property-card";
import { getPublishedProperties } from "@/lib/properties";

export const revalidate = 60;

export default async function StaysPage() {
  const properties = await getPublishedProperties();
  return (
    <main>
      <PageHero eyebrow="Available Stays" title="Boutique homes for restful, well-designed travel." description="Explore a growing collection of thoughtfully prepared short-term rentals with elevated amenities, simple arrivals, and responsive hospitality." />
      <section className="py-20">
        <div className="container-shell">
          {properties.length ? <div className="grid gap-6 md:grid-cols-3">{properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div> : <div className="rounded-[2rem] border border-border bg-card p-10 text-center"><h2 className="font-serif text-3xl">Properties are coming soon.</h2><p className="mt-3 text-muted-foreground">Published Luxe Haven stays will appear here automatically once added in the admin dashboard.</p></div>}
        </div>
      </section>
    </main>
  );
}
