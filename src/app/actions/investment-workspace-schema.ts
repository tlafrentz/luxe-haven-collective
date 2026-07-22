import { z } from "zod";

import { AcquisitionType } from "@/features/investment-intelligence/domain/enums/acquisition-type";
import { MarketTrend } from "@/features/investment-intelligence/domain/enums/market-trend";
import { PropertyType } from "@/features/investment-intelligence/domain/enums/property-type";

const money = z.number().finite().nonnegative().max(100_000_000);
const percentage = z.number().finite().min(0).max(100);
const count = z.number().finite().int().nonnegative().max(100_000);
const shortText = z.string().trim().min(1).max(160);
const property = z.object({
  id: z.string().trim().min(1).max(160), address1: shortText, city: shortText, state: z.string().trim().min(2).max(40), postalCode: z.string().trim().min(3).max(16),
  furnishingBudget: money, propertyType: z.nativeEnum(PropertyType), bedrooms: count.max(100), bathrooms: z.number().finite().nonnegative().max(100), squareFeet: count,
}).strict();
const revenue = z.object({ projectedAdr: money.max(100_000), projectedOccupancyPercentage: percentage, averageLengthOfStay: z.number().finite().positive().max(365), confidencePercentage: percentage.optional() }).strict();
const market = z.object({ name: shortText, submarket: z.string().max(160).optional(), medianAdr: money.max(100_000), medianOccupancyPercentage: percentage, trend: z.nativeEnum(MarketTrend).optional() }).strict();
const sharedOperating = {
  managementFeePercentage: percentage, monthlyUtilities: money, annualInsurance: money, annualCleaning: money, annualSoftware: money, annualSupplies: money,
  maintenanceReservePercentage: percentage, capitalReservePercentage: percentage,
};
const purchase = z.object({
  acquisitionType: z.literal(AcquisitionType.Purchase),
  property: property.extend({ purchasePrice: money.positive(), closingCosts: money }).strict(),
  financing: z.object({ downPaymentPercentage: percentage, interestRatePercentage: percentage, loanTermYears: z.number().int().min(1).max(50) }).strict(),
  revenue,
  operating: z.object({ ...sharedOperating, annualTaxes: money }).strict(),
  market,
  comparables: z.array(z.never()).max(0),
}).strict();
const rental = z.object({
  acquisitionType: z.literal(AcquisitionType.RentalArbitrage), property,
  lease: z.object({ monthlyLease: money.positive(), securityDeposit: money, leaseTermMonths: z.number().int().min(1).max(120), startupCosts: money, utilitiesIncluded: z.boolean() }).strict(),
  revenue, operating: z.object(sharedOperating).strict(), market, comparables: z.array(z.never()).max(0),
}).strict();

export const investmentWorkspaceActionSchema = z.object({
  clientRequestId: z.string().trim().min(1).max(160),
  address: z.object({ streetAddress: shortText, city: shortText, state: z.string().trim().min(2).max(40), postalCode: z.string().trim().min(3).max(16), countryCode: z.literal("US").optional() }).strict(),
  investmentInput: z.discriminatedUnion("acquisitionType", [purchase, rental]),
  userProvidedAssumptionKeys: z.array(z.string().trim().min(1).max(100)).max(40).refine((values) => new Set(values).size === values.length, "Assumption keys must be unique."),
  marketRequest: z.object({ saleValuation: z.boolean(), longTermRent: z.boolean() }).strict().refine((value) => value.saleValuation || value.longTermRent, "At least one Market analysis must be requested."),
  appliedLearningContext: z.never().optional(),
}).strict();

export type ValidatedInvestmentWorkspaceActionInput = z.infer<typeof investmentWorkspaceActionSchema>;
