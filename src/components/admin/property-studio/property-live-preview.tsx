"use client";

import Image from "next/image";

import { usePropertyStudio } from "./property-context";

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function PropertyLivePreview() {
  const { draft, media } = usePropertyStudio();

  const imageUrls = getStringArray(draft.image_urls);
  const amenities = getStringArray(draft.amenities);

  const featuredImageUrl = getString(
    draft.featured_image_url,
  );

  const hero =
    media.find((item) => item.is_featured)?.url ||
    featuredImageUrl ||
    media[0]?.url ||
    imageUrls[0];

  const title =
    getString(draft.headline) ||
    getString(draft.name) ||
    "Property headline";

  const description =
    getString(draft.short_description) ||
    getString(draft.description) ||
    "Your property description will appear here.";

  const city = getString(draft.city, "City");
  const state = getString(draft.state, "State");

  const bedrooms = getNumber(draft.bedrooms);
  const bathrooms = getNumber(draft.bathrooms);
  const guests = getNumber(draft.max_guests);
  const nightlyRate = getNumber(draft.nightly_rate);

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">
      <div className="relative aspect-[4/3] bg-zinc-800">
        {hero ? (
          <Image
            src={hero}
            alt={title}
            fill
            className="object-cover"
            sizes="420px"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400">
            Upload a featured image
          </div>
        )}
      </div>

      <div className="space-y-6 bg-white p-6 text-zinc-900">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
            {city}, {state}
          </p>

          <h2 className="mt-2 text-3xl font-bold leading-tight">
            {title}
          </h2>

          <p className="mt-4 line-clamp-5 leading-7 text-zinc-600">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm text-zinc-600">
          <span>{bedrooms} Bedrooms</span>
          <span aria-hidden="true">•</span>
          <span>{bathrooms} Baths</span>
          <span aria-hidden="true">•</span>
          <span>{guests} Guests</span>
        </div>

        <div className="rounded-2xl border bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">
            Starting From
          </p>

          <p className="mt-1 text-3xl font-bold">
            ${nightlyRate.toLocaleString()}
            <span className="text-base font-normal text-zinc-500">
              {" "}
              / night
            </span>
          </p>
        </div>

        {amenities.length > 0 ? (
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
              Amenities
            </p>

            <div className="flex flex-wrap gap-2">
              {amenities.slice(0, 8).map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="w-full rounded-xl bg-black py-3 font-semibold text-white"
        >
          View Property
        </button>
      </div>
    </div>
  );
}
