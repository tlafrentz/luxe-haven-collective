import type { MarketComparableProviderCandidate } from "../../application/providers/market-comparable-provider";
import { ProviderError, ProviderErrorCode } from "../../application/providers/provider-error";
import { ProviderType } from "../../domain/enums/provider-type";
import type { RentCastComparableRecord } from "./rentcast-comparable-types";

export function mapRentCastMarketComparable(record: RentCastComparableRecord, sourceRank: number): MarketComparableProviderCandidate {
  const externalId = record.id?.trim();
  const formatted = record.formattedAddress?.trim();
  if (!externalId || !formatted) throw new ProviderError({ provider: ProviderType.RentCast, code: ProviderErrorCode.InvalidResponse, message: "RentCast returned a comparable without an id or formatted address." });
  return {
    externalId,
    address: { formatted, addressLine1: clean(record.addressLine1) ?? formatted.split(",")[0]?.trim(), city: clean(record.city) ?? formatted.split(",")[1]?.trim(), state: clean(record.state) ?? formatted.split(",")[2]?.trim().split(/\s+/)[0], postalCode: clean(record.zipCode) ?? formatted.match(/\b\d{5}(?:-\d{4})?\b/)?.[0], country: "US" },
    propertyType: clean(record.propertyType), bedrooms: nonNegative(record.bedrooms), bathrooms: nonNegative(record.bathrooms), squareFeet: positive(record.squareFootage), yearBuilt: year(record.yearBuilt),
    latitude: coordinate(record.latitude, -90, 90), longitude: coordinate(record.longitude, -180, 180), distanceMiles: nonNegative(record.distance), price: nonNegative(record.price),
    listedAt: date(record.listedDate), daysOnMarket: nonNegative(record.daysOnMarket), listingStatus: status(record.status, record.removedDate), sourceRank,
  };
}

function clean(value?: string): string | undefined { return value?.trim() || undefined; }
function nonNegative(value?: number): number | undefined { return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined; }
function positive(value?: number): number | undefined { return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined; }
function coordinate(value: number | undefined, minimum: number, maximum: number): number | undefined { return value !== undefined && Number.isFinite(value) && value >= minimum && value <= maximum ? value : undefined; }
function year(value?: number): number | undefined { return value !== undefined && Number.isInteger(value) && value >= 1600 && value <= 2200 ? value : undefined; }
function date(value?: string): Date | undefined { if (!value) return undefined; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? undefined : parsed; }
function status(value?: string, removedDate?: string): "active" | "inactive" | "sold" | "unknown" { const normalized = value?.toLowerCase(); if (normalized === "active") return "active"; if (normalized === "inactive") return "inactive"; if (normalized === "sold") return "sold"; return removedDate ? "inactive" : "unknown"; }
