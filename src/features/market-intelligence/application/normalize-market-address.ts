import type { MarketPropertyLookupAddress, NormalizedMarketAddress } from "../domain/property-resolution";
import type { PropertyAddress } from "../domain/entities/property-record";

const STREET_SUFFIXES: Readonly<Record<string, string>> = Object.freeze({
  street: "st", avenue: "ave", boulevard: "blvd", road: "rd", drive: "dr",
  lane: "ln", court: "ct", circle: "cir", highway: "hwy", parkway: "pkwy",
  terrace: "ter", place: "pl",
});

const STATE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  arizona: "AZ", california: "CA", colorado: "CO", florida: "FL", georgia: "GA",
  illinois: "IL", nevada: "NV", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "south carolina": "SC", tennessee: "TN", texas: "TX",
  utah: "UT", washington: "WA",
});

export function normalizeMarketAddress(address: MarketPropertyLookupAddress): NormalizedMarketAddress {
  const streetAddress = required(address.streetAddress, "Street address");
  const city = required(address.city, "City");
  const stateInput = required(address.state, "State");
  const postalInput = required(address.postalCode, "Postal code");
  const state = STATE_NAMES[stateInput.toLowerCase()] ?? stateInput.toUpperCase();
  const postalCode = postalInput.replace(/\s+/g, "").slice(0, 5);
  const country = (address.countryCode?.trim() || "US").toUpperCase();
  const street = normalizeStreet(streetAddress);
  const unit = extractUnit(streetAddress);
  const display = Object.freeze({
    formatted: `${streetAddress}, ${city}, ${state} ${postalCode}`,
    addressLine1: streetAddress,
    city,
    state,
    postalCode,
    country,
  });
  return Object.freeze({ display, comparisonKey: `${street}|${city.toLowerCase()}|${state}|${postalCode}|${unit ?? ""}`, unit });
}

export function normalizeProviderAddress(address: PropertyAddress): NormalizedMarketAddress | undefined {
  const streetAddress = address.addressLine1?.trim() ?? address.formatted.split(",")[0]?.trim();
  if (!streetAddress || !address.city || !address.state || !address.postalCode) return undefined;
  return normalizeMarketAddress({ streetAddress, city: address.city, state: address.state, postalCode: address.postalCode, countryCode: address.country });
}

function normalizeStreet(value: string): string {
  return value.toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim().split(" ").map((part) => STREET_SUFFIXES[part] ?? part).join(" ");
}

function extractUnit(value: string): string | undefined {
  const match = value.toLowerCase().match(/(?:\bunit\b|\bapt\b|#)\s*([a-z0-9-]+)/);
  return match?.[1];
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}
