import { ProviderErrorCode } from "../../application/providers/provider-error";
import {
  REALTY_API_MAPPING_VERSION,
  SUBJECT_PROPERTY_SCHEMA_VERSION,
  freezeSubjectProperty,
  type PropertyFieldLineage,
  type PropertyLookupCandidate,
  type SubjectProperty,
} from "../../domain/subject-property";
import { REALTY_API_ENDPOINTS } from "./endpoints";
import { RealtyApiError } from "./errors";
import type { RealtyApiAutocompleteResponseDto, RealtyApiPropertyResponseDto } from "./types";

export function mapRealtyApiCandidates(response: RealtyApiAutocompleteResponseDto): readonly PropertyLookupCandidate[] {
  const records = findCollection(response);
  const candidates = records.flatMap((record): PropertyLookupCandidate[] => {
    const providerPropertyId = text(record.property_id, record.propertyId, record.id);
    const formattedAddress = addressText(record);
    if (!providerPropertyId || !formattedAddress || !looksLikeStreetAddress(formattedAddress)) return [];
    const coordinates = coordinatePair(record);
    return [{
      providerPropertyId,
      ...(text(record.listing_id, record.listingId) ? { listingId: text(record.listing_id, record.listingId)! } : {}),
      formattedAddress,
      ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
    }];
  });
  const unique = new Map(candidates.map((candidate) => [`${candidate.providerPropertyId}:${candidate.listingId ?? ""}`, candidate]));
  return Object.freeze([...unique.values()]);
}

export interface RealtyApiMappingContext {
  readonly subjectPropertyId: string;
  readonly snapshotId: string;
  readonly snapshotVersion: number;
  readonly retrievedAt: Date;
  readonly requestedAddressKey: string;
}

export function mapRealtyApiProperty(
  response: RealtyApiPropertyResponseDto,
  candidate: PropertyLookupCandidate,
  context: RealtyApiMappingContext,
): SubjectProperty {
  const record = unwrapProperty(response);
  const providerPropertyId = text(record.property_id, record.propertyId, record.id) ?? candidate.providerPropertyId;
  if (!providerPropertyId) invalid("RealtyAPI returned a property without an id.");

  const address = object(record.address) ?? object(object(record.location)?.address) ?? {};
  const description = object(record.description) ?? {};
  const location = object(record.location) ?? {};
  const coordinates = coordinatePair(record) ?? coordinatePair(location) ?? coordinatePair(address);
  const sourceEndpoint = REALTY_API_ENDPOINTS.detailsById;
  const lineage: PropertyFieldLineage = freezeSubjectProperty({
    provider: "realtyapi",
    retrievedAt: new Date(context.retrievedAt),
    snapshotId: context.snapshotId,
    sourceEndpoint,
  });
  const sourced = <T>(value: T | undefined) => freezeSubjectProperty({ value: value ?? null, lineage });
  const formatted = text(address.formatted_address, address.formattedAddress, address.line, record.formatted_address, record.full_address) ?? candidate.formattedAddress;
  const fields = {
    formatted,
    street: text(address.line, address.street, address.address_line, address.addressLine1),
    city: text(address.city, address.locality),
    state: text(address.state_code, address.state, address.region),
    postalCode: text(address.postal_code, address.zip_code, address.zip, address.postalCode),
    county: text(address.county, location.county),
    propertyType: text(description.type, description.property_type, record.property_type),
    bedrooms: number(description.beds, description.bedrooms, record.beds, record.bedrooms),
    bathrooms: number(description.baths, description.bathrooms, record.baths, record.bathrooms),
    livingArea: number(description.sqft, description.living_area, record.sqft, record.square_feet),
    lotSize: number(description.lot_sqft, description.lot_size, record.lot_sqft, record.lot_size),
    yearBuilt: integer(description.year_built, record.year_built),
    listingStatus: text(record.status, record.listing_status, object(record.listing)?.status),
    listPrice: number(record.list_price, record.price, object(record.listing)?.price),
    lastSalePrice: number(record.last_sold_price, record.last_sale_price, object(record.last_sale)?.price),
    lastSaleDate: dateText(record.last_sold_date, record.last_sale_date, object(record.last_sale)?.date),
  };
  if (!fields.formatted.trim()) invalid("RealtyAPI returned a property without a formatted address.");

  const completenessValues = [
    fields.formatted, fields.street, fields.city, fields.state, fields.postalCode,
    fields.county, coordinates?.latitude, coordinates?.longitude, fields.propertyType,
    fields.bedrooms, fields.bathrooms, fields.livingArea, fields.lotSize,
    fields.yearBuilt, fields.listingStatus, fields.listPrice, fields.lastSalePrice, fields.lastSaleDate,
  ];
  const names = [
    "address.formatted", "address.street", "address.city", "address.state", "address.postalCode",
    "address.county", "address.latitude", "address.longitude", "physical.propertyType",
    "physical.bedrooms", "physical.bathrooms", "physical.livingAreaSquareFeet",
    "physical.lotSizeSquareFeet", "physical.yearBuilt", "listing.status", "listing.listPrice",
    "listing.lastSalePrice", "listing.lastSaleDate",
  ];
  const missingFields = names.filter((_, index) => completenessValues[index] === undefined);
  const completeness = Math.round(((names.length - missingFields.length) / names.length) * 100);
  const returnedKey = formatted.toLowerCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
  const addressMatch = returnedKey === context.requestedAddressKey ? "exact" : "normalized";
  const score = Math.min(100, Math.round(55 + completeness * 0.35 + (addressMatch === "exact" ? 10 : 5)));

  return freezeSubjectProperty({
    id: context.subjectPropertyId,
    providerPropertyId,
    provider: "realtyapi",
    address: {
      formatted: sourced(fields.formatted), street: sourced(fields.street), city: sourced(fields.city),
      state: sourced(fields.state), postalCode: sourced(fields.postalCode), county: sourced(fields.county),
      latitude: sourced(coordinates?.latitude), longitude: sourced(coordinates?.longitude),
    },
    physical: {
      propertyType: sourced(fields.propertyType), bedrooms: sourced(fields.bedrooms),
      bathrooms: sourced(fields.bathrooms), livingAreaSquareFeet: sourced(fields.livingArea),
      lotSizeSquareFeet: sourced(fields.lotSize), yearBuilt: sourced(fields.yearBuilt),
    },
    listing: {
      status: sourced(fields.listingStatus), listPrice: sourced(fields.listPrice),
      lastSalePrice: sourced(fields.lastSalePrice), lastSaleDate: sourced(fields.lastSaleDate),
    },
    retrievedAt: new Date(context.retrievedAt),
    snapshotId: context.snapshotId,
    snapshotVersion: context.snapshotVersion,
    schemaVersion: SUBJECT_PROPERTY_SCHEMA_VERSION,
    providerVersion: REALTY_API_MAPPING_VERSION,
    sourceEndpoint,
    confidence: {
      score,
      level: score >= 85 ? "high" : score >= 70 ? "medium" : "low",
      completeness,
      addressMatch,
      reasons: Object.freeze([
        "RealtyAPI lookup completed successfully.",
        `${names.length - missingFields.length} of ${names.length} canonical fields were populated.`,
        addressMatch === "exact" ? "The normalized returned address matched the request." : "The provider returned a normalized address variant.",
      ]),
    },
    missingFields: Object.freeze(missingFields),
  });
}

function findCollection(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isObject);
  const root = object(value);
  if (!root) return [];
  for (const key of ["autocomplete", "results", "suggestions", "data", "properties"]) {
    const candidate = root[key];
    if (Array.isArray(candidate)) return candidate.filter(isObject);
    if (isObject(candidate)) {
      const nested = findCollection(candidate);
      if (nested.length) return nested;
    }
  }
  return [];
}

function unwrapProperty(value: unknown): Record<string, unknown> {
  const root = object(value);
  if (!root) invalid("RealtyAPI returned an invalid property response.");
  for (const key of ["data", "home", "property", "result"]) {
    const nested = object(root[key]);
    if (nested) return unwrapProperty(nested);
  }
  return root;
}

function addressText(record: Record<string, unknown>): string | undefined {
  const address = object(record.address);
  return text(record.display_name, record.full_address, record.formatted_address,
    address?.formatted_address, address?.formattedAddress, address?.line);
}

function coordinatePair(value: Record<string, unknown>): { latitude: number; longitude: number } | undefined {
  const centroid = object(value.centroid) ?? object(value.coordinate) ?? object(value.coordinates);
  const latitude = signedNumber(value.latitude, value.lat, centroid?.latitude, centroid?.lat);
  const longitude = signedNumber(value.longitude, value.lon, value.lng, centroid?.longitude, centroid?.lon, centroid?.lng);
  return latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return isObject(value) ? value : undefined;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
}
function number(...values: unknown[]): number | undefined {
  const parsed = signedNumber(...values);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}
function signedNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.replace(/[$,]/g, "")) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
}
function integer(...values: unknown[]): number | undefined {
  const value = number(...values);
  return value === undefined ? undefined : Math.trunc(value);
}
function dateText(...values: unknown[]): string | undefined {
  const value = text(...values);
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
function looksLikeStreetAddress(value: string): boolean {
  return /\d/.test(value) && /[a-z]/i.test(value);
}
function invalid(message: string): never {
  throw new RealtyApiError({ code: ProviderErrorCode.InvalidResponse, message });
}
