import { notFound } from "next/navigation";
import { CTASection } from "@/components/marketing/cta-section";
import { getPropertyBySlug, featuredProperties } from "@/lib/properties";

export function generateStaticParams() {
  return featuredProperties.map((property) => ({ slug: property.slug }));
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = getPropertyBySlug(slug);
  if (!property) notFound();

  return (
    <main>
      <section className="luxury-gradient border-b border-border py-16">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_.7fr] lg:items-end">
          <div><p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">{property.city}, {property.state}</p><h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">{property.name}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{property.description}</p></div>
          <div className="rounded-[2rem] border border-border bg-card p-6"><p className="text-sm text-muted-foreground">Starting at</p><p className="mt-2 font-serif text-5xl">${property.nightly_rate}<span className="text-base font-sans text-muted-foreground"> / night</span></p><button className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Request Dates</button></div>
        </div>
      </section>
      <section className="py-10"><div className="container-shell"><img src={property.images[0]} alt={property.name} className="h-[560px] w-full rounded-[2.5rem] object-cover" /></div></section>
      <section className="py-12"><div className="container-shell grid gap-10 lg:grid-cols-[.75fr_1.25fr]"><div className="rounded-3xl border border-border bg-card p-6"><p className="font-semibold">Property Details</p><div className="mt-5 grid gap-3 text-sm text-muted-foreground"><p>{property.bedrooms} bedrooms</p><p>{property.bathrooms} bathrooms</p><p>Up to {property.max_guests} guests</p></div></div><div><h2 className="font-serif text-4xl">Amenities guests appreciate</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{property.amenities.map((amenity) => <p key={amenity} className="rounded-full border border-border bg-card px-5 py-3 text-sm">{amenity}</p>)}</div><p className="mt-8 leading-8 text-muted-foreground">This stay is prepared with Luxe Haven standards: clear arrival instructions, clean presentation, responsive support, and comfortable essentials for work, rest, and local exploring.</p></div></div></section>
      <CTASection title="Interested in this stay?" description="Send your travel dates and we’ll help confirm availability, rates, and fit." />
    </main>
  );
}
