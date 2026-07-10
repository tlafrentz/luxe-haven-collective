import Image from "next/image";
import type { Property, PropertyMedia } from "@/types/database";

type PropertyLivePreviewProps = {
  property?: Property;
  media?: PropertyMedia[];
};

export function PropertyLivePreview({
  property,
  media = [],
}: PropertyLivePreviewProps) {
  const hero =
    media.find((item) => item.is_featured)?.url ||
    property?.featured_image_url ||
    media[0]?.url ||
    property?.image_urls?.[0];

  const title = property?.headline || property?.name || "Property headline";
  const description =
    property?.short_description ||
    property?.description ||
    "Your property description will appear here.";

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brass">
        Live Preview
      </p>

      <div className="mt-4 overflow-hidden rounded-[1.5rem] bg-stone-100 text-stone-950 shadow-2xl">
        <div className="relative aspect-[4/3] bg-stone-200">
          {hero ? (
            <Image src={hero} alt={title} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone-500">
              Upload a hero image
            </div>
          )}
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            {property?.city || "City"}, {property?.state || "State"}
          </p>

          <h3 className="mt-2 font-serif text-3xl leading-tight">{title}</h3>

          <p className="mt-3 line-clamp-4 text-sm leading-6 text-stone-600">
            {description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-stone-600">
            <span>{property?.bedrooms ?? 0} bedrooms</span>
            <span>•</span>
            <span>{property?.bathrooms ?? 0} baths</span>
            <span>•</span>
            <span>{property?.max_guests ?? 0} guests</span>
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-stone-500">Starting at</p>
            <p className="mt-1 text-2xl font-semibold">
              ${Number(property?.nightly_rate ?? 0).toLocaleString()}
              <span className="text-sm font-normal text-stone-500"> / night</span>
            </p>
          </div>

          {property?.amenities?.length ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                Amenities
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {property.amenities.slice(0, 6).map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full bg-white px-3 py-1 text-xs text-stone-600 shadow-sm"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="mt-5 w-full rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
          >
            View property
          </button>
        </div>
      </div>
    </div>
  );
}
