export const hpmTierMonthlyPrices = {
  starter: 99,
  professional: 249,
  portfolio: 599,
} as const;

export type HpmTierSlug = keyof typeof hpmTierMonthlyPrices;

export function formatMonthlyPrice(amount: number) {
  return `$${amount} / month`;
}
