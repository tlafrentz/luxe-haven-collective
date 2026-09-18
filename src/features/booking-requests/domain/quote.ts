import { calculateStayNights } from "@/features/bookings/domain";

/**
 * LHS-UX-010/011: the provisional estimate uses the property's already
 * configured nightly_rate/cleaning_fee/tax_rate — real, configured data,
 * not an invented rate model. Discount rules, proration, and rounding
 * refinements remain an open business decision (PRD §13.2) and are not
 * fabricated here.
 */
export type QuoteRateSource = Readonly<{
  nightlyRate: number;
  cleaningFee: number;
  taxRate: number | null;
}>;

export type CalculatedQuote = Readonly<{
  nights: number;
  nightlyRateMinor: number;
  subtotalMinor: number;
  cleaningFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
}>;

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function calculateProvisionalQuote(
  rates: QuoteRateSource,
  stay: Readonly<{ arrival: string; departure: string }>,
  currency = "USD",
): CalculatedQuote {
  const nights = calculateStayNights(stay.arrival, stay.departure);
  const nightlyRateMinor = toMinor(rates.nightlyRate);
  const subtotalMinor = nightlyRateMinor * nights;
  const cleaningFeeMinor = toMinor(rates.cleaningFee);
  const taxMinor = Math.round((subtotalMinor + cleaningFeeMinor) * (rates.taxRate ?? 0));
  const totalMinor = subtotalMinor + cleaningFeeMinor + taxMinor;

  return Object.freeze({
    nights,
    nightlyRateMinor,
    subtotalMinor,
    cleaningFeeMinor,
    taxMinor,
    totalMinor,
    currency,
  });
}
