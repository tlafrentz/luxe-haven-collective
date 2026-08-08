import type { Money, ProductOffer } from "./schema";

export type CatalogOffer = Pick<
  ProductOffer,
  "id" | "status" | "availability" | "listedPrice" | "lastVerifiedAt"
> &
  Readonly<{ preferred?: boolean }>;

export function representativeOffer(offers: readonly CatalogOffer[]) {
  const eligible = offers.filter(
    (offer) =>
      offer.status === "active" &&
      offer.availability === "in_stock" &&
      offer.listedPrice !== null,
  );
  return (
    eligible.find((offer) => offer.preferred) ??
    [...eligible].sort(
      (left, right) =>
        left.listedPrice!.amountMinor - right.listedPrice!.amountMinor,
    )[0] ??
    null
  );
}

export function offerFreshness(
  lastVerifiedAt: string | null,
  now = new Date(),
  currentDays = 30,
): "current" | "stale" | "unknown" {
  if (!lastVerifiedAt) return "unknown";
  const observed = new Date(lastVerifiedAt);
  if (Number.isNaN(observed.getTime())) return "unknown";
  return now.getTime() - observed.getTime() <= currentDays * 86_400_000
    ? "current"
    : "stale";
}

export function normalizeCatalogName(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function probableProductDuplicate(
  candidate: Readonly<{
    name: string;
    brand?: string | null;
    manufacturerPartNumber?: string | null;
  }>,
  existing: Readonly<{
    name: string;
    brand?: string | null;
    manufacturerPartNumber?: string | null;
  }>,
) {
  const part = normalizeCatalogName(candidate.manufacturerPartNumber ?? "");
  const existingPart = normalizeCatalogName(
    existing.manufacturerPartNumber ?? "",
  );
  if (part && existingPart && part === existingPart) return true;
  return (
    normalizeCatalogName(candidate.name) ===
      normalizeCatalogName(existing.name) &&
    normalizeCatalogName(candidate.brand ?? "") ===
      normalizeCatalogName(existing.brand ?? "")
  );
}

export function canonicalizeRetailerUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("OFFER_URL_INVALID");
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|ref|tag|aff|affiliate|clickid|gclid|fbclid)$/i.test(key))
      url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString();
}

export function requiredPurchases(
  requiredUnits: number,
  unitsPerPurchase: number,
) {
  if (!Number.isSafeInteger(requiredUnits) || requiredUnits < 0)
    throw new Error("CATALOG_REQUIRED_UNITS_INVALID");
  if (!Number.isSafeInteger(unitsPerPurchase) || unitsPerPurchase < 1)
    throw new Error("CATALOG_PACK_SIZE_INVALID");
  return Math.ceil(requiredUnits / unitsPerPurchase);
}

export function catalogAttention(
  input: Readonly<{
    categoryId: string | null;
    roomCount: number;
    primaryMediaId: string | null;
    activeOffers: readonly CatalogOffer[];
  }>,
) {
  const issues: string[] = [];
  if (!input.categoryId) issues.push("Missing category");
  if (!input.roomCount) issues.push("Missing room assignment");
  if (!input.primaryMediaId) issues.push("Missing image");
  if (!input.activeOffers.length) issues.push("No active offer");
  else if (input.activeOffers.every((offer) => offer.listedPrice === null))
    issues.push("Missing offer price");
  if (
    input.activeOffers.some(
      (offer) => offerFreshness(offer.lastVerifiedAt) === "stale",
    )
  )
    issues.push("Offer price stale");
  return issues;
}

export function minorUnits(value: string, currency = "USD"): Money {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("CATALOG_PRICE_INVALID");
  const [whole, fraction = ""] = value.trim().split(".");
  return {
    amountMinor: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
    currency,
  };
}
