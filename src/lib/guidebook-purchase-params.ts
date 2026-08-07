export type GuidebookPurchaseParams = Partial<{
  package: string;
  propertyType: string;
  bedrooms: string;
  guestCapacity: string;
  primaryGoal: string;
  promo: string;
  propertyName: string;
  address: string;
  timezone: string;
  currency: string;
  addOns: string;
}>;

export function purchaseQuery(params: GuidebookPurchaseParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}
