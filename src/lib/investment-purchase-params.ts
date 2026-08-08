export type InvestmentPurchaseParams = Partial<{
  package: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  squareFootage: string;
  strategy: string;
  promo: string;
  addOns: string;
}>;

export function purchaseQuery(params: InvestmentPurchaseParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}
