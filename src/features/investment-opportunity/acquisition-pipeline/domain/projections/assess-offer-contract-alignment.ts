import type { AcquisitionOfferTerms } from "../offers/acquisition-offer-terms";
import type { AcquisitionContractTerms } from "../contracts/acquisition-contract-terms";
export type CommercialTermDifference = Readonly<{ field: string; offer?: unknown; contract?: unknown }>;
export type OfferContractAlignment = Readonly<{ status: "aligned" | "changed" | "external"; differences: readonly CommercialTermDifference[] }>;
export function assessOfferContractAlignment(offer: AcquisitionOfferTerms | undefined, contract: AcquisitionContractTerms, external = false): OfferContractAlignment {
  if (external) return Object.freeze({ status: "external", differences: Object.freeze([]) });
  const differences: CommercialTermDifference[] = [];
  if (!offer || offer.route !== contract.route) differences.push({ field: "route" });
  else if (offer.route === "purchase" && contract.route === "purchase" && offer.offerPrice.amount !== contract.contractPrice.amount) differences.push({ field: "purchase-price", offer: offer.offerPrice.amount, contract: contract.contractPrice.amount });
  else if (offer.route === "rental-arbitrage" && contract.route === "rental-arbitrage" && offer.proposedMonthlyRent.amount !== contract.contractedMonthlyRent.amount) differences.push({ field: "monthly-rent", offer: offer.proposedMonthlyRent.amount, contract: contract.contractedMonthlyRent.amount });
  return Object.freeze({ status: differences.length ? "changed" : "aligned", differences: Object.freeze(differences) });
}
