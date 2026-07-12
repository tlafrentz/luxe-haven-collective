import type { HospitableProperty } from "../types";

export type HospitablePropertyMapping = {
  externalId: string;
  externalName: string;
  property: {
    name: string;
    headline: string | null;
    short_description: string | null;
    description: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
    bedrooms: number;
    bathrooms: number;
    beds: number;
    max_guests: number;
    image_urls: string[];
    featured_image_url: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    property_type: string | null;
    status: "active" | "paused";
    metadata: Record<string, unknown>;
  };
};

function toNullableNumber(
  value: string | number | null | undefined,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCount(
  value: number | null | undefined,
): number {
  if (
    value === null ||
    value === undefined ||
    value < 0
  ) {
    return 0;
  }

  return value;
}

function mapAddressLine2(
  property: HospitableProperty,
): string | null {
  const unitNumber =
    property.address?.number?.trim();

  return unitNumber
    ? `Unit ${unitNumber}`
    : null;
}

export function mapHospitableProperty(
  source: HospitableProperty,
): HospitablePropertyMapping {
  const address = source.address;
  const capacity = source.capacity;

  return {
    externalId: source.id,
    externalName: source.name,
    property: {
      name:
        source.public_name?.trim() ||
        source.name.trim(),
      headline:
        source.name.trim() || null,
      short_description:
        source.summary?.trim() || null,
      description:
        source.description?.trim() || null,
      address_line_1:
        address?.street?.trim() || null,
      address_line_2:
        mapAddressLine2(source),
      city:
        address?.city?.trim() || null,
      state:
        address?.state?.trim() || null,
      postal_code:
        address?.postcode?.trim() || null,
      country:
        address?.country?.trim() || "US",
      latitude:
        toNullableNumber(
          address?.coordinates?.latitude,
        ),
      longitude:
        toNullableNumber(
          address?.coordinates?.longitude,
        ),
      bedrooms:
        normalizeCount(capacity?.bedrooms),
      bathrooms:
        normalizeCount(capacity?.bathrooms),
      beds:
        normalizeCount(capacity?.beds),
      max_guests:
        normalizeCount(capacity?.max),
      image_urls:
        source.picture ? [source.picture] : [],
      featured_image_url:
        source.picture,
      check_in_time:
        source.checkin,
      check_out_time:
        source.checkout,
      property_type:
        source.property_type,
      status:
        source.listed ? "active" : "paused",
      metadata: {
        hospitable: {
          external_id: source.id,
          currency: source.currency,
          timezone: source.timezone,
          room_type: source.room_type,
          amenities: source.amenities,
          room_details: source.room_details,
          house_rules: source.house_rules,
          tags: source.tags,
          listed: source.listed,
          calendar_restricted:
            source.calendar_restricted,
          address_display:
            source.address?.display ?? null,
        },
      },
    },
  };
}
