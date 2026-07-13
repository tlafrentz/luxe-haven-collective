import Image from "next/image";
import Link from "next/link";

import {
  getPropertyByIdForAdmin,
  propertyImage,
} from "@/lib/properties";

type AdminPropertyDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminPropertyDetailPage({
  params,
}: AdminPropertyDetailPageProps) {
  const { id } = await params;
  const property =
    await getPropertyByIdForAdmin(id);

  const stats = [
    ["Bedrooms", property.bedrooms],
    ["Bathrooms", property.bathrooms],
    ["Guests", property.max_guests],
    ["Min nights", property.minimum_nights],
  ];

  return (
    <section>
      <Link
        href="/admin/properties"
        className="text-sm text-white/50 hover:text-white"
      >
        ← Back to properties
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brass">
            {property.status}
          </p>

          <h1 className="mt-3 font-serif text-5xl">
            {property.name}
          </h1>

          <p className="mt-4 text-white/60">
            {property.headline ||
              property.short_description ||
              property.description}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/admin/properties/${property.id}/edit`}
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Edit property
            </Link>

            {property.status === "active" ? (
              <Link
                href={`/stays/${property.slug}`}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                View live page
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative h-80 overflow-hidden rounded-[2rem]">
          <Image
            src={propertyImage(property)}
            alt={property.name}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
          >
            <p className="text-sm text-white/45">
              {label}
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-serif text-3xl">
            Amenities
          </h2>

          <ul className="mt-4 grid gap-2 text-white/60">
            {property.amenities.map(
              (item) => (
                <li key={item}>
                  • {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-serif text-3xl">
            Rules
          </h2>

          <ul className="mt-4 grid gap-2 text-white/60">
            {property.house_rules.map(
              (item) => (
                <li key={item}>
                  • {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
