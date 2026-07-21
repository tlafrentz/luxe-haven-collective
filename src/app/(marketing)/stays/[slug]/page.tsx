import type { Metadata } from "next";
import Link from "next/link";

import { CTASection } from "@/components/marketing/cta-section";
import { SafeImage } from "@/components/shared/safe-image";
import {
  getPublishedPropertyBySlug,
  propertyImage,
} from "@/lib/properties";

type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property =
    await getPublishedPropertyBySlug(slug);

  const title =
    property.seo_title ||
    `${property.name} | Luxe Haven Collective`;

  const description =
    property.seo_description ||
    property.short_description ||
    property.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [propertyImage(property)],
    },
  };
}

export default async function PropertyDetailPage({
  params,
}: PropertyPageProps) {
  const { slug } = await params;
  const property =
    await getPublishedPropertyBySlug(slug);

  const gallery = [
    propertyImage(property),
    ...(property.image_urls ?? []),
  ]
    .filter(Boolean)
    .filter(
      (image, index, images) =>
        images.indexOf(image) === index,
    )
    .slice(0, 5);

  return (
    <main>
      <section className="luxury-gradient border-b border-border py-16">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_.7fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
              {property.city}, {property.state}
            </p>

            <h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">
              {property.name}
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              {property.headline ||
                property.short_description ||
                property.description}
            </p>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Starting at
            </p>

            <p className="mt-2 font-serif text-5xl">
              $
              {Number(
                property.nightly_rate,
              ).toLocaleString()}
              <span className="text-base font-sans text-muted-foreground">
                {" "}
                / night
              </span>
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <p>
                {property.minimum_nights}+ night
                minimum
              </p>
              <p>
                Up to {property.max_guests} guests
              </p>
              <p>
                Check-in {property.check_in_time}
              </p>
              <p>
                Check-out {property.check_out_time}
              </p>
            </div>

            <Link
              href="/contact?service=stay"
              className="mt-6 block rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground"
            >
              Request Dates
            </Link>
          </div>
        </div>
      </section>

      {gallery.length > 0 ? (
        <section className="py-10">
          <div className="container-shell grid gap-4 md:grid-cols-[1.4fr_.6fr]">
            <div className="relative h-[520px] overflow-hidden rounded-[2.5rem]">
              <SafeImage
                src={gallery[0]}
                alt={property.name}
                fill
                priority
                sizes="(min-width: 768px) 70vw, 100vw"
                className="object-cover"
              />
            </div>

            {gallery.length > 1 ? (
              <div className="grid gap-4">
                {gallery
                  .slice(1, 3)
                  .map((image, index) => (
                    <div
                      key={image}
                      className="relative h-[252px] overflow-hidden rounded-[2rem]"
                    >
                      <SafeImage
                        src={image}
                        alt={`${property.name} gallery ${index + 1}`}
                        fill
                        sizes="(min-width: 768px) 30vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="py-12">
        <div className="container-shell grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <aside className="rounded-3xl border border-border bg-card p-6">
            <p className="font-semibold">
              Property Details
            </p>

            <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
              <p>
                {property.bedrooms} bedrooms
              </p>
              <p>
                {property.bathrooms} bathrooms
              </p>
              <p>
                Up to {property.max_guests} guests
              </p>
              <p>
                {property.neighborhood
                  ? `${property.neighborhood}, `
                  : ""}
                {property.city}
              </p>
            </div>
          </aside>

          <div>
            <h2 className="font-serif text-4xl">
              Designed for effortless stays
            </h2>

            <p className="mt-5 leading-8 text-muted-foreground">
              {property.description}
            </p>

            {property.highlights?.length ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {property.highlights.map(
                  (highlight) => (
                    <p
                      key={highlight}
                      className="rounded-2xl border border-border bg-card px-5 py-4 text-sm"
                    >
                      {highlight}
                    </p>
                  ),
                )}
              </div>
            ) : null}

            {property.amenities?.length ? (
              <>
                <h3 className="mt-10 font-serif text-3xl">
                  Amenities guests appreciate
                </h3>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {property.amenities.map(
                    (amenity) => (
                      <p
                        key={amenity}
                        className="rounded-full border border-border bg-card px-5 py-3 text-sm"
                      >
                        {amenity}
                      </p>
                    ),
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <CTASection
        title="Interested in this stay?"
        description="Send your travel dates and we’ll help confirm availability, rates, and fit."
      />
    </main>
  );
}
