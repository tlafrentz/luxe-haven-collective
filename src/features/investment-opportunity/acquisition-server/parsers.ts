import { z } from "zod";
import type { AcquisitionImplementedServerCommandInput, AcquisitionServerCommandResult } from "./contracts";

const idempotency = z.string().uuid();
const opportunityId = z.string().regex(/^investment-opportunity-/);
const pipelineId = z.string().regex(/^acquisition-pipeline-/);
const envelope = z.object({
  opportunityId,
  pipelineId: pipelineId.optional(),
  expectedOpportunityVersion: z.number().int().positive(),
  expectedPipelineVersion: z.number().int().positive().optional(),
  idempotencyKey: idempotency,
}).strict();
const pipelineEnvelope = envelope.extend({ pipelineId, expectedPipelineVersion: z.number().int().positive() }).strict();
const money = z.object({ amount: z.string().regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/).refine((value) => Number.isFinite(Number(value)) && Number(value) <= 1_000_000_000_000), currency: z.literal("USD") }).strict();
const iso = z.string().datetime({ offset: true });
const sourceAnalysis = z.object({ analysisId: z.string().regex(/^opportunity-analysis-/), version: z.number().int().positive(), analyzedAt: iso, route: z.enum(["purchase", "rental-arbitrage"]), assumptionFingerprint: z.string().trim().max(200).optional() }).strict();

const activate = z.object({ commandType: z.literal("activate-pipeline"), envelope, analysisId: z.string().regex(/^opportunity-analysis-/), analysisVersion: z.number().int().positive(), route: z.enum(["purchase", "rental-arbitrage"]) }).strict();
const transition = z.object({ commandType: z.literal("transition-stage"), envelope: pipelineEnvelope, targetStage: z.enum(["pursuit", "offer-preparation", "due-diligence"]), reason: z.object({ code: z.enum(["offer-revised", "counteroffer-received", "agreement-amended", "due-diligence-reopened", "closing-condition-unresolved", "operator-correction", "other"]), explanation: z.string().trim().max(2000).optional() }).strict().optional() }).strict();
const submit = z.object({ commandType: z.literal("submit-offer"), envelope: pipelineEnvelope, offerId: z.string().regex(/^acquisition-offer-/) }).strict();
const beginClosing = z.object({ commandType: z.literal("begin-closing-preparation"), envelope: pipelineEnvelope }).strict();
const exit = z.object({ commandType: z.literal("exit-pipeline"), envelope: pipelineEnvelope, reason: z.enum(["offer-rejected", "terms-unacceptable", "inspection-failed", "financing-failed", "appraisal-failed", "title-or-legal", "regulatory-ineligible", "landlord-declined", "economics-deteriorated", "operator-withdrew", "counterparty-withdrew", "opportunity-unavailable", "other"]), explanation: z.string().trim().max(2000).optional(), exitedFromStage: z.enum(["pursuit", "offer-preparation", "offer-submitted", "negotiating", "under-contract", "due-diligence", "closing-preparation"]), reconsideration: z.discriminatedUnion("eligible", [z.object({ eligible: z.literal(false) }).strict(), z.object({ eligible: z.literal(true), notBefore: iso.optional(), note: z.string().trim().max(2000).optional() }).strict()]) }).strict();
const purchaseOffer = z.object({ commandType: z.literal("create-offer-draft"), envelope: pipelineEnvelope, route: z.literal("purchase"), sourceAnalysis, terms: z.object({ offerPrice: money, earnestMoney: money.optional(), financing: z.discriminatedUnion("type", [z.object({ type: z.literal("cash") }).strict(), z.object({ type: z.literal("financed"), financingContingency: z.boolean(), downPayment: money.optional(), downPaymentPercentage: z.number().min(0).max(100).optional() }).strict()]), requestedSellerConcessions: money.optional(), proposedClosingDate: iso.optional(), expiration: iso.optional(), conditions: z.array(z.object({ type: z.enum(["inspection", "financing", "appraisal", "title-review", "hoa-review", "insurance", "seller-disclosure", "other"]), explanation: z.string().trim().max(2000).optional() }).strict()).max(20) }).strict() }).strict();
const rentalOffer = z.object({ commandType: z.literal("create-offer-draft"), envelope: pipelineEnvelope, route: z.literal("rental-arbitrage"), sourceAnalysis, terms: z.object({ proposedMonthlyRent: money, securityDeposit: money.optional(), leaseTermMonths: z.number().int().min(1).max(240), proposedCommencementDate: iso.optional(), expiration: iso.optional(), operatingPermission: z.discriminatedUnion("required", [z.object({ required: z.literal(true), requestedForm: z.enum(["lease-clause", "written-addendum", "separate-authorization"]) }).strict(), z.object({ required: z.literal(false), reason: z.string().trim().min(1).max(2000) }).strict()]), utilityResponsibilities: z.array(z.object({ utility: z.enum(["electricity", "gas", "water", "sewer", "trash", "internet", "other"]), party: z.enum(["operator", "landlord", "shared"]), explanation: z.string().trim().max(2000).optional() }).strict()).max(20), requestedConcessions: z.array(z.object({ description: z.string().trim().min(1).max(500), amount: money.optional() }).strict()).max(20), conditions: z.array(z.object({ type: z.enum(["landlord-authorization", "regulatory-eligibility", "utilities", "other"]), explanation: z.string().trim().max(2000).optional() }).strict()).max(20) }).strict() }).strict();
const contractSource = z.discriminatedUnion("type", [z.object({ type: z.literal("accepted-offer"), offerId: z.string().regex(/^acquisition-offer-/) }).strict(), z.object({ type: z.literal("accepted-counteroffer"), offerId: z.string().regex(/^acquisition-offer-/), responseId: z.string().regex(/^counterparty-response-/) }).strict(), z.object({ type: z.literal("external-agreement"), externalReference: z.string().trim().max(200).optional(), explanation: z.string().trim().min(1).max(2000) }).strict()]);
const purchaseContract = z.object({ route: z.literal("purchase"), contractPrice: money, financing: z.discriminatedUnion("type", [z.object({ type: z.literal("cash") }).strict(), z.object({ type: z.literal("financed"), financingContingency: z.boolean(), plannedDownPayment: money.optional() }).strict()]), effectiveDate: iso, scheduledClosingDate: iso }).strict();
const rentalContract = z.object({ route: z.literal("rental-arbitrage"), contractedMonthlyRent: money, leaseTermMonths: z.number().int().min(1).max(240), effectiveDate: iso, commencementDate: iso, operatingPermission: z.discriminatedUnion("status", [z.object({ status: z.literal("explicitly-authorized"), form: z.enum(["lease-clause", "written-addendum", "separate-authorization"]) }).strict(), z.object({ status: z.literal("not-authorized") }).strict(), z.object({ status: z.literal("unclear"), explanation: z.string().trim().min(1).max(2000) }).strict()]) }).strict();
const contract = z.object({ commandType: z.literal("record-contract"), envelope: pipelineEnvelope, source: contractSource, terms: z.discriminatedUnion("route", [purchaseContract, rentalContract]) }).strict();
const closingFacts = z.discriminatedUnion("route", [z.object({ route: z.literal("purchase"), closedAt: iso, finalPurchasePrice: money, financingType: z.enum(["cash", "financed"]) }).strict(), z.object({ route: z.literal("rental-arbitrage"), agreementExecutedAt: iso, commencementAt: iso, finalMonthlyRent: money, operatingPermissionStatus: z.enum(["explicitly-authorized", "unclear", "not-authorized"]) }).strict()]);
const close = z.object({ commandType: z.literal("close-acquisition"), envelope: pipelineEnvelope, closingFacts }).strict();
const schema = z.union([activate, transition, submit, beginClosing, exit, purchaseOffer, rentalOffer, contract, close]);

export function parseAcquisitionServerCommand(raw: unknown): Readonly<{ ok: true; value: AcquisitionImplementedServerCommandInput }> | Readonly<{ ok: false; result: AcquisitionServerCommandResult }> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data as AcquisitionImplementedServerCommandInput };
  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".") || "form";
    (fields[path] ??= []).push("Enter a valid value.");
  }
  return { ok: false, result: { status: "validation-error", code: "ACQUISITION_COMMAND_INPUT_INVALID", fieldErrors: fields, formErrors: [] } };
}
