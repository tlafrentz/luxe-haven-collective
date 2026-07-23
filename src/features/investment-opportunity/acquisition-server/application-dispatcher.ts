import {
  activateAcquisitionPipeline,
  beginClosingPreparation,
  closeAcquisition,
  createAcquisitionOfferDraft,
  exitAcquisitionPipeline,
  recordAcquisitionContract,
  submitAcquisitionOffer,
  transitionAcquisitionStage,
  type AcquisitionApplicationCommandContext,
} from "@/features/investment-opportunity/acquisition-pipeline/application";
import {
  AcquisitionPipelineVersion,
  createAcquisitionCommandId,
  createAcquisitionOfferId,
  createAcquisitionPipelineId,
  createCounterpartyResponseId,
} from "@/features/investment-opportunity/acquisition-pipeline/domain";
import { createInvestmentOpportunityId, createOpportunityAnalysisId, createOpportunityOwnerId } from "@/features/investment-opportunity/domain";
import type { AcquisitionImplementedServerCommandInput } from "./contracts";

type ApplicationDependencies = Parameters<typeof activateAcquisitionPipeline>[1];
export type AcquisitionApplicationCommandExecution = Readonly<{
  data: Readonly<{ pipelineId: string; opportunityId: string; stage: string; pipelineVersion: number; terminal: boolean }>;
  commandId: string;
  replayed: boolean;
  pipelineVersion: number;
  opportunityVersion: number;
}>;
export interface AcquisitionServerApplicationDispatcher {
  execute(input: AcquisitionImplementedServerCommandInput, context: TrustedAcquisitionCommandContext): Promise<AcquisitionApplicationCommandExecution>;
}
export type TrustedAcquisitionCommandContext = Readonly<{
  commandId: string;
  requestFingerprint: string;
  actor: Readonly<{ type: "user" | "system"; id: string }>;
  ownerId: string;
  requestedAt: Date;
}>;

export class ProductionAcquisitionServerApplicationDispatcher implements AcquisitionServerApplicationDispatcher {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public async execute(input: AcquisitionImplementedServerCommandInput, trusted: TrustedAcquisitionCommandContext): Promise<AcquisitionApplicationCommandExecution> {
    const context: AcquisitionApplicationCommandContext = {
      commandId: createAcquisitionCommandId(trusted.commandId),
      requestFingerprint: trusted.requestFingerprint,
      actor: trusted.actor,
      ownerId: createOpportunityOwnerId(trusted.ownerId),
      occurredAt: new Date(trusted.requestedAt),
      expectedOpportunityVersion: input.envelope.expectedOpportunityVersion,
      ...(input.envelope.expectedPipelineVersion ? { expectedPipelineVersion: AcquisitionPipelineVersion.from(input.envelope.expectedPipelineVersion) } : {}),
    };
    let result;
    switch (input.commandType) {
      case "activate-pipeline":
        result = await activateAcquisitionPipeline({ context, opportunityId: createInvestmentOpportunityId(input.envelope.opportunityId), analysisId: createOpportunityAnalysisId(input.analysisId), analysisVersion: input.analysisVersion }, this.dependencies);
        break;
      case "transition-stage":
        result = await transitionAcquisitionStage({ context, pipelineId: createAcquisitionPipelineId(input.envelope.pipelineId), targetStage: input.targetStage, ...(input.reason ? { reason: input.reason } : {}) }, this.dependencies);
        break;
      case "exit-pipeline":
        result = await exitAcquisitionPipeline({ context, pipelineId: createAcquisitionPipelineId(input.envelope.pipelineId), exit: { reason: input.reason, ...(input.explanation ? { explanation: input.explanation } : {}), exitedFromStage: input.exitedFromStage, reconsideration: input.reconsideration.eligible ? { eligible: true, ...(input.reconsideration.notBefore ? { notBefore: new Date(input.reconsideration.notBefore) } : {}), ...(input.reconsideration.note ? { note: input.reconsideration.note } : {}) } : { eligible: false } } }, this.dependencies);
        break;
      case "begin-closing-preparation":
        result = await beginClosingPreparation({ context, pipelineId: createAcquisitionPipelineId(input.envelope.pipelineId) }, this.dependencies);
        break;
      case "close-acquisition":
        result = await closeAcquisition({ context, pipelineId: createAcquisitionPipelineId(input.envelope.pipelineId), closingFacts: input.closingFacts.route === "purchase" ? { route: "purchase", closedAt: new Date(input.closingFacts.closedAt), finalPurchasePrice: money(input.closingFacts.finalPurchasePrice), financingType: input.closingFacts.financingType } : { route: "rental-arbitrage", agreementExecutedAt: new Date(input.closingFacts.agreementExecutedAt), commencementAt: new Date(input.closingFacts.commencementAt), finalMonthlyRent: money(input.closingFacts.finalMonthlyRent), operatingPermissionStatus: input.closingFacts.operatingPermissionStatus } }, this.dependencies);
        break;
      case "create-offer-draft":
        result = await createAcquisitionOfferDraft({ context, pipelineId: createAcquisitionPipelineId(input.envelope.pipelineId), sourceAnalysis: { analysisId: createOpportunityAnalysisId(input.sourceAnalysis.analysisId), analysisVersion: input.sourceAnalysis.version, analyzedAt: new Date(input.sourceAnalysis.analyzedAt), route: input.sourceAnalysis.route, ...(input.sourceAnalysis.assumptionFingerprint ? { assumptionFingerprint: input.sourceAnalysis.assumptionFingerprint } : {}) }, terms: offerTerms(input) }, this.dependencies);
        break;
      case "submit-offer":
        result = await submitAcquisitionOffer({ context, pipelineId: createAcquisitionPipelineId(input.envelope.pipelineId), offerId: createAcquisitionOfferId(input.offerId) }, this.dependencies);
        break;
      case "record-contract":
        result = await recordAcquisitionContract({ context, pipelineId: createAcquisitionPipelineId(input.envelope.pipelineId), source: input.source.type === "accepted-offer" ? { type: "accepted-offer", offerId: createAcquisitionOfferId(input.source.offerId) } : input.source.type === "accepted-counteroffer" ? { type: "accepted-counteroffer", offerId: createAcquisitionOfferId(input.source.offerId), responseId: createCounterpartyResponseId(input.source.responseId) } : input.source, terms: contractTerms(input) }, this.dependencies);
        break;
    }
    return Object.freeze({ data: { pipelineId: result.data.pipelineId, opportunityId: result.data.opportunityId, stage: result.data.stage, pipelineVersion: result.data.pipelineVersion, terminal: result.data.terminal }, commandId: result.commandId.value, replayed: result.replayed, pipelineVersion: result.pipelineVersion, opportunityVersion: result.opportunityVersion ?? input.envelope.expectedOpportunityVersion });
  }
}

function money(value: Readonly<{ amount: string; currency: "USD" }>) { return { amount: Number(value.amount), currency: "USD" as const }; }
function offerTerms(input: Extract<AcquisitionImplementedServerCommandInput, { commandType: "create-offer-draft" }>) {
  return input.route === "purchase"
    ? { route: "purchase" as const, offerPrice: money(input.terms.offerPrice), ...(input.terms.earnestMoney ? { earnestMoney: money(input.terms.earnestMoney) } : {}), financing: input.terms.financing.type === "cash" ? { type: "cash" as const } : { type: "financed" as const, financingContingency: input.terms.financing.financingContingency, ...(input.terms.financing.downPayment ? { downPayment: money(input.terms.financing.downPayment) } : {}), ...(input.terms.financing.downPaymentPercentage !== undefined ? { downPaymentPercentage: input.terms.financing.downPaymentPercentage } : {}) }, ...(input.terms.requestedSellerConcessions ? { requestedSellerConcessions: money(input.terms.requestedSellerConcessions) } : {}), ...(input.terms.proposedClosingDate ? { proposedClosingDate: new Date(input.terms.proposedClosingDate) } : {}), ...(input.terms.expiration ? { expiration: new Date(input.terms.expiration) } : {}), conditions: input.terms.conditions }
    : { route: "rental-arbitrage" as const, proposedMonthlyRent: money(input.terms.proposedMonthlyRent), ...(input.terms.securityDeposit ? { securityDeposit: money(input.terms.securityDeposit) } : {}), leaseTerm: { months: input.terms.leaseTermMonths }, ...(input.terms.proposedCommencementDate ? { proposedCommencementDate: new Date(input.terms.proposedCommencementDate) } : {}), ...(input.terms.expiration ? { expiration: new Date(input.terms.expiration) } : {}), operatingPermission: input.terms.operatingPermission, utilityResponsibilities: input.terms.utilityResponsibilities, requestedConcessions: input.terms.requestedConcessions.map((value) => ({ description: value.description, ...(value.amount ? { amount: money(value.amount) } : {}) })), conditions: input.terms.conditions };
}
function contractTerms(input: Extract<AcquisitionImplementedServerCommandInput, { commandType: "record-contract" }>) {
  return input.terms.route === "purchase"
    ? { route: "purchase" as const, contractPrice: money(input.terms.contractPrice), financing: input.terms.financing.type === "cash" ? { type: "cash" as const } : { type: "financed" as const, financingContingency: input.terms.financing.financingContingency, ...(input.terms.financing.plannedDownPayment ? { plannedDownPayment: money(input.terms.financing.plannedDownPayment) } : {}) }, effectiveDate: new Date(input.terms.effectiveDate), scheduledClosingDate: new Date(input.terms.scheduledClosingDate), agreedConditions: [] }
    : { route: "rental-arbitrage" as const, contractedMonthlyRent: money(input.terms.contractedMonthlyRent), leaseTerm: { months: input.terms.leaseTermMonths }, effectiveDate: new Date(input.terms.effectiveDate), commencementDate: new Date(input.terms.commencementDate), operatingPermission: input.terms.operatingPermission, utilityResponsibilities: [], agreedConcessions: [], agreedConditions: [] };
}
