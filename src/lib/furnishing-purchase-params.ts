export type FurnishingPurchaseParams = Partial<{
  package: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sizeRange: string;
  market: string;
  zip: string;
  promo: string;
  propertyName: string;
  address: string;
  timezone: string;
  currency: string;
  ownershipConfirmed: string;
  addOns: string;
}>;

export function purchaseQuery(params: FurnishingPurchaseParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}
