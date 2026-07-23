import { AcquisitionDomainError } from "../errors";

export type AcquisitionMoney = Readonly<{ amount: number; currency: "USD" }>;
export type LeaseTerm = Readonly<{ months: number }>;
export type PurchaseFinancingIntent = Readonly<{ type: "cash" } | { type: "financed"; downPayment?: AcquisitionMoney; downPaymentPercentage?: number; financingContingency: boolean }>;
export type PurchaseOfferCondition = Readonly<{ type: "inspection" | "financing" | "appraisal" | "title-review" | "hoa-review" | "insurance" | "seller-disclosure" | "other"; explanation?: string }>;
export type RentalUtilityType = "electricity" | "gas" | "water" | "sewer" | "trash" | "internet" | "other";
export type UtilityResponsibility = Readonly<{ utility: RentalUtilityType; party: "operator" | "landlord" | "shared"; explanation?: string }>;
export type RentalOperatingPermissionRequest = Readonly<{ required: true; requestedForm: "lease-clause" | "written-addendum" | "separate-authorization" } | { required: false; reason: string }>;
export type RentalOfferCondition = Readonly<{ type: "landlord-authorization" | "regulatory-eligibility" | "utilities" | "other"; explanation?: string }>;
export type RentalConcession = Readonly<{ description: string; amount?: AcquisitionMoney }>;
export type PurchaseAcquisitionOfferTerms = Readonly<{ route: "purchase"; offerPrice: AcquisitionMoney; earnestMoney?: AcquisitionMoney; financing: PurchaseFinancingIntent; requestedSellerConcessions?: AcquisitionMoney; proposedClosingDate?: Date; expiration?: Date; conditions: readonly PurchaseOfferCondition[] }>;
export type RentalArbitrageAcquisitionOfferTerms = Readonly<{ route: "rental-arbitrage"; proposedMonthlyRent: AcquisitionMoney; securityDeposit?: AcquisitionMoney; leaseTerm: LeaseTerm; proposedCommencementDate?: Date; requestedConcessions: readonly RentalConcession[]; operatingPermission: RentalOperatingPermissionRequest; utilityResponsibilities: readonly UtilityResponsibility[]; expiration?: Date; conditions: readonly RentalOfferCondition[] }>;
export type AcquisitionOfferTerms = PurchaseAcquisitionOfferTerms | RentalArbitrageAcquisitionOfferTerms;
export function createAcquisitionMoney(input: AcquisitionMoney): AcquisitionMoney { if (!Number.isFinite(input.amount) || input.amount < 0 || input.currency !== "USD") throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); return Object.freeze({ amount: input.amount, currency: "USD" }); }
export function validateAcquisitionOfferTerms(terms: AcquisitionOfferTerms): void {
  if (terms.route === "purchase") { if (terms.offerPrice.amount <= 0) throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); if (terms.financing.type === "cash" && "financingContingency" in terms.financing && terms.financing.financingContingency) throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); validateMoney(terms.offerPrice, true); validateOptionalMoney(terms.earnestMoney); validateOptionalMoney(terms.requestedSellerConcessions); validateConditions(terms.conditions); }
  else { if (terms.proposedMonthlyRent.amount <= 0 || !Number.isInteger(terms.leaseTerm.months) || terms.leaseTerm.months < 1) throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); validateMoney(terms.proposedMonthlyRent, true); validateOptionalMoney(terms.securityDeposit); validateUtilities(terms.utilityResponsibilities); validateConditions(terms.conditions); if (terms.operatingPermission.required === false && !terms.operatingPermission.reason.trim()) throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); }
  const dates = terms.route === "purchase" ? [terms.expiration, terms.proposedClosingDate] : [terms.expiration, terms.proposedCommencementDate];
  for (const date of dates) if (date && Number.isNaN(date.getTime())) throw new AcquisitionDomainError("ACQUISITION_OFFER_EXPIRATION_INVALID");
}
function validateMoney(value: AcquisitionMoney, positive = false) { if (value.currency !== "USD" || !Number.isFinite(value.amount) || (positive ? value.amount <= 0 : value.amount < 0)) throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); }
function validateOptionalMoney(value?: AcquisitionMoney) { if (value) validateMoney(value); }
function validateConditions(values: readonly { type: string; explanation?: string }[]) { const types = values.map(value => value.type); if (new Set(types).size !== types.length || values.some(value => value.type === "other" && !value.explanation?.trim())) throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); }
function validateUtilities(values: readonly UtilityResponsibility[]) { const keys = values.map(value => value.utility); if (new Set(keys).size !== keys.length || values.some(value => value.utility === "other" && !value.explanation?.trim())) throw new AcquisitionDomainError("ACQUISITION_OFFER_TERMS_INVALID"); }
