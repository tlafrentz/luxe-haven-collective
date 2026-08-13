export const hpmTierMonthlyPrices = {
  starter: 99,
  professional: 199,
  portfolio: null,
} as const;

export type HpmTierSlug = keyof typeof hpmTierMonthlyPrices;

export function formatMonthlyPrice(amount: number) {
  return `$${amount} / month`;
}
