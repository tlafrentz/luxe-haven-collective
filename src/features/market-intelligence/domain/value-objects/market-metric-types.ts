/** Market-owned normalized monetary input. Provider adapters normalize currency before construction. */
export interface MarketMoney { readonly amount: number; readonly currency: "USD" }
/** Market-owned normalized percentage input. */
export interface MarketPercentage { readonly value: number }
