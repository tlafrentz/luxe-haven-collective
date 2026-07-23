import type { InvestmentOpportunityId, InvestmentOpportunityRoute, OpportunityStatus } from "@/features/investment-opportunity/domain";
import { createAcquisitionActorReference, type AcquisitionActorReference } from "./acquisition-actor-reference";
import { createAcquisitionCommandContext, type AcquisitionCommandContextInput } from "./acquisition-command-context";
import { createAcquisitionExit, type AcquisitionExit } from "./acquisition-exit";
import { AcquisitionDomainError } from "./errors";
import { createAcquisitionPipelineId, createAcquisitionStageTransitionId, createAcquisitionOfferId, createCounterpartyResponseId, createAcquisitionContractId, type AcquisitionPipelineId, type AcquisitionStageTransitionId, type AcquisitionOfferId, type CounterpartyResponseId, type AcquisitionContractId } from "./identifiers";
import { createPipelineActivation, type PipelineActivation } from "./pipeline-activation";
import { AcquisitionPipelineVersion } from "./acquisition-pipeline-version";
import { assessAcquisitionStageTransition, type AcquisitionTransitionClassification } from "./acquisition-stage-policy";
import { type AcquisitionStage } from "./acquisition-stage";
import { createAcquisitionTransitionReason, type AcquisitionTransitionReason } from "./acquisition-transition";
import { deriveOpportunityStatusFromAcquisitionStage } from "./opportunity-status-synchronization";
import { assertSupportedAcquisitionPipelineRoute } from "./acquisition-route-policy";
import type { AcquisitionActivity } from "./acquisition-activity";
import type { AcquisitionStageHistoryEntry } from "./acquisition-stage-history";
import type { AcquisitionOffer, AcquisitionOfferSequence, OfferSourceAnalysisReference } from "./offers/acquisition-offer";
import { createAcquisitionOfferSequence } from "./offers/acquisition-offer";
import { validateAcquisitionOfferTerms, type AcquisitionOfferTerms } from "./offers/acquisition-offer-terms";
import type { AcceptedAgreementBasis, CounterpartyReference, CounterpartyResponse } from "./offers/counterparty-response";
import type { AcquisitionContract, AcquisitionContractSource } from "./contracts/acquisition-contract";
import { validateAcquisitionContractTerms, type AcquisitionContractTerms } from "./contracts/acquisition-contract-terms";

type PipelineState = Readonly<{
  id: AcquisitionPipelineId;
  opportunityId: InvestmentOpportunityId;
  route: InvestmentOpportunityRoute;
  activation: PipelineActivation;
  currentStage: AcquisitionStage;
  history: readonly AcquisitionStageHistoryEntry[];
  activity: readonly AcquisitionActivity[];
  version: AcquisitionPipelineVersion;
  offers: readonly AcquisitionOffer[];
  responses: readonly CounterpartyResponse[];
  currentOfferId?: AcquisitionOfferId;
  acceptedAgreement?: AcceptedAgreementBasis;
  contract?: AcquisitionContract;
}>;

export type AcquisitionPipelineProps = Readonly<PipelineState>;
export type AcquisitionSynchronizationProjection = Readonly<{ status: OpportunityStatus; pipelineAuthoritative: true }>;
export type AcquisitionPipelineTransitionInput = Readonly<AcquisitionCommandContextInput & { to: AcquisitionStage; reason?: AcquisitionTransitionReason }>;
export type OfferCommand = Readonly<{ offerId?: AcquisitionOfferId; sourceAnalysis: OfferSourceAnalysisReference; terms: AcquisitionOfferTerms; context: AcquisitionCommandContextInput; replacesOfferId?: AcquisitionOfferId }>;
export type ResponseCommand = Readonly<{ offerId: AcquisitionOfferId; response: Omit<CounterpartyResponse, "offerId" | "recordedAt" | "recordedBy">; context: AcquisitionCommandContextInput }>;

export class AcquisitionPipeline {
  private state: PipelineState;
  private constructor(state: PipelineState) { this.state = state; }

  public static activate(input: Readonly<{ id?: AcquisitionPipelineId; opportunityId: InvestmentOpportunityId; route: InvestmentOpportunityRoute; activation: PipelineActivation; context: AcquisitionCommandContextInput }>): AcquisitionPipeline {
    assertSupportedAcquisitionPipelineRoute(input.route);
    const context = createAcquisitionCommandContext(input.context);
    if (context.expectedPipelineVersion !== undefined) throw new AcquisitionDomainError("INVALID_ACQUISITION_COMMAND_CONTEXT");
    createAcquisitionActorReference(context.actor);
    const activation = createPipelineActivation(input.activation);
    if (activation.sourceAnalysis.route !== undefined && activation.sourceAnalysis.route !== input.route) throw new AcquisitionDomainError("ACQUISITION_ROUTE_MISMATCH", { expected: input.route, actual: activation.sourceAnalysis.route });
    const id = input.id ?? createAcquisitionPipelineId();
    const version = AcquisitionPipelineVersion.initial();
    const transitionId = createAcquisitionStageTransitionId();
    const entry: AcquisitionStageHistoryEntry = Object.freeze({ transitionId, to: "pursuit", occurredAt: new Date(context.occurredAt), actor: { ...context.actor }, classification: "forward", aggregateVersion: version });
    const activity: AcquisitionActivity = Object.freeze({ id: transitionId, type: "pipeline-activated", occurredAt: new Date(context.occurredAt), actor: { ...context.actor }, details: Object.freeze({ opportunityId: input.opportunityId.value, route: input.route, analysisId: activation.sourceAnalysis.analysisId.value, analysisVersion: activation.sourceAnalysis.analysisVersion }), aggregateVersion: version, to: "pursuit" });
    return new AcquisitionPipeline({ id, opportunityId: input.opportunityId, route: input.route, activation, currentStage: "pursuit", history: Object.freeze([entry]), activity: Object.freeze([activity]), version, offers: Object.freeze([]), responses: Object.freeze([]) });
  }

  public static restore(props: AcquisitionPipelineProps): AcquisitionPipeline {
    if (!props.history.length || props.history[0]?.to !== "pursuit" || props.history[props.history.length - 1]?.to !== props.currentStage || props.history.length !== props.activity.length) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    for (let index = 0; index < props.history.length; index += 1) {
      const entry = props.history[index];
      if (!entry || entry.aggregateVersion.value !== index + 1 || index > 0 && entry.occurredAt.getTime() < props.history[index - 1]!.occurredAt.getTime()) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    }
    const offerIds = new Set(props.offers.map(value => value.id.value));
    if (offerIds.size !== props.offers.length || new Set(props.offers.map(value => value.sequence.value)).size !== props.offers.length || props.offers.some(value => value.pipelineId.value !== props.id.value || value.route !== props.route || value.status === "draft" && value.submittedAt !== undefined)) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    const currentOffers = props.offers.filter(value => value.current);
    if (currentOffers.length > 1 || props.currentOfferId && !offerIds.has(props.currentOfferId.value) || props.currentOfferId && currentOffers[0]?.id.value !== props.currentOfferId.value) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    if (props.acceptedAgreement && !offerIds.has(props.acceptedAgreement.offerId.value)) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    if (props.contract && props.contract.route !== props.route || props.contract && props.contract.pipelineId.value !== props.id.value) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    return new AcquisitionPipeline(cloneState(props));
  }

  public get props(): AcquisitionPipelineProps { return cloneState(this.state); }
  public get id(): AcquisitionPipelineId { return this.state.id; }
  public get opportunityId(): InvestmentOpportunityId { return this.state.opportunityId; }
  public get route(): InvestmentOpportunityRoute { return this.state.route; }
  public get activation(): PipelineActivation { return cloneActivation(this.state.activation); }
  public currentStage(): AcquisitionStage { return this.state.currentStage; }
  public history(): readonly AcquisitionStageHistoryEntry[] { return this.state.history.map(cloneHistory); }
  public activity(): readonly AcquisitionActivity[] { return this.state.activity.map(cloneActivity); }
  public version(): AcquisitionPipelineVersion { return AcquisitionPipelineVersion.from(this.state.version.value); }
  public isTerminal(): boolean { return this.state.currentStage === "exited" || this.state.currentStage === "closed-acquired"; }
  public offers(): readonly AcquisitionOffer[] { return this.state.offers.map(cloneOffer); }
  public responses(): readonly CounterpartyResponse[] { return this.state.responses.map(cloneResponse); }
  public currentOffer(): AcquisitionOffer | null { const offer = this.state.offers.find(value => value.id.equals(this.state.currentOfferId)); return offer ? cloneOffer(offer) : null; }
  public acceptedAgreement(): AcceptedAgreementBasis | undefined { return this.state.acceptedAgreement ? cloneAgreement(this.state.acceptedAgreement) : undefined; }
  public contract(): AcquisitionContract | undefined { return this.state.contract ? cloneContract(this.state.contract) : undefined; }
  public statusProjection(): AcquisitionSynchronizationProjection { return Object.freeze({ status: deriveOpportunityStatusFromAcquisitionStage(this.state.currentStage), pipelineAuthoritative: true }); }

  public transition(input: AcquisitionPipelineTransitionInput): void {
    const context = createAcquisitionCommandContext(input);
    this.assertExpectedVersion(context.expectedPipelineVersion);
    if (input.to === "exited") throw new AcquisitionDomainError("INVALID_ACQUISITION_EXIT", { message: "Use exit with an AcquisitionExit outcome." });
    if (input.to === "closed-acquired") throw new AcquisitionDomainError("INVALID_ACQUISITION_STAGE_TRANSITION", { message: "Use closeAcquisition with closing facts." });
    const assessment = assessAcquisitionStageTransition(this.state.currentStage, input.to);
    if (!assessment.allowed) throw new AcquisitionDomainError(assessment.errorCode ?? "INVALID_ACQUISITION_STAGE_TRANSITION", { from: this.state.currentStage, to: input.to });
    if (assessment.reasonRequired && !input.reason) throw new AcquisitionDomainError("ACQUISITION_TRANSITION_REASON_REQUIRED", { from: this.state.currentStage, to: input.to });
    const reason = input.reason ? createAcquisitionTransitionReason(input.reason) : undefined;
    this.applyTransition(input.to, context.occurredAt, context.actor, assessment.classification as AcquisitionTransitionClassification, reason, context.commandId.value);
  }

  public exit(input: Readonly<{ exit: AcquisitionExit; context: AcquisitionCommandContextInput }>): void {
    const context = createAcquisitionCommandContext(input.context);
    this.assertExpectedVersion(context.expectedPipelineVersion);
    if (input.exit.exitedFromStage !== this.state.currentStage) throw new AcquisitionDomainError("INVALID_ACQUISITION_EXIT", { expectedStage: this.state.currentStage, actualStage: input.exit.exitedFromStage });
    const exit = createAcquisitionExit({ ...input.exit, route: this.state.route });
    this.applyTransition("exited", context.occurredAt, context.actor, "terminal", undefined, context.commandId.value, "pipeline-exited", { reason: exit.reason, ...(exit.explanation ? { explanation: exit.explanation } : {}) });
  }

  public closeAcquisition(contextInput: AcquisitionCommandContextInput): void {
    const context = createAcquisitionCommandContext(contextInput);
    this.assertExpectedVersion(context.expectedPipelineVersion);
    if (this.isTerminal()) throw new AcquisitionDomainError("ACQUISITION_PIPELINE_TERMINAL", { stage: this.state.currentStage });
    if (this.state.currentStage !== "closing-preparation") throw new AcquisitionDomainError("INVALID_ACQUISITION_STAGE_TRANSITION", { from: this.state.currentStage, to: "closed-acquired" });
    this.applyTransition("closed-acquired", context.occurredAt, context.actor, "terminal", undefined, context.commandId.value, "pipeline-closed-acquired");
  }

  public createOfferDraft(input: OfferCommand): AcquisitionOffer {
    const context = createAcquisitionCommandContext(input.context); this.assertExpectedVersion(context.expectedPipelineVersion); this.ensureCommerciallyActive(); validateAcquisitionOfferTerms(input.terms); this.assertOfferRoute(input.sourceAnalysis.route, input.terms.route); if (input.offerId && this.state.offers.some(value => value.id.equals(input.offerId))) throw new AcquisitionDomainError("ACQUISITION_OFFER_ID_ALREADY_EXISTS"); if (this.state.offers.some(value => value.status === "draft")) throw new AcquisitionDomainError("ACQUISITION_OFFER_NOT_EDITABLE");
    const id = input.offerId ?? createAcquisitionOfferId(), sequence = createAcquisitionOfferSequence(this.state.offers.length + 1), source = cloneSource(input.sourceAnalysis); const offer: AcquisitionOffer = Object.freeze({ id, pipelineId: this.id, sequence, route: this.route, status: "draft", sourceAnalysis: source, terms: cloneTerms(input.terms), createdBy: { ...context.actor }, createdAt: new Date(context.occurredAt), current: true, ...(input.replacesOfferId ? { replacesOfferId: input.replacesOfferId } : {}) });
    this.mutateCommercial("offer-draft-created", context, { offers: Object.freeze([...this.state.offers.map(value => Object.freeze({ ...value, current: false })), offer]), currentOfferId: id }, { offerId: id.value, sequence: sequence.value }); return cloneOffer(offer);
  }
  public updateOfferDraft(input: Readonly<{ offerId: AcquisitionOfferId; terms: AcquisitionOfferTerms; context: AcquisitionCommandContextInput }>): void { const context = createAcquisitionCommandContext(input.context); this.assertExpectedVersion(context.expectedPipelineVersion); const index = this.offerIndex(input.offerId); const offer = this.state.offers[index]!; if (offer.status !== "draft") throw new AcquisitionDomainError("ACQUISITION_OFFER_NOT_EDITABLE"); validateAcquisitionOfferTerms(input.terms); this.assertOfferRoute(offer.route, input.terms.route); const updated = Object.freeze({ ...offer, terms: cloneTerms(input.terms) }); this.mutateCommercial("offer-draft-updated", context, { offers: this.replaceOffer(index, updated) }, { offerId: offer.id.value }); }
  public rebaseOfferDraft(input: Readonly<{ offerId: AcquisitionOfferId; sourceAnalysis: OfferSourceAnalysisReference; context: AcquisitionCommandContextInput }>): void { const context = createAcquisitionCommandContext(input.context); this.assertExpectedVersion(context.expectedPipelineVersion); const index = this.offerIndex(input.offerId), offer = this.state.offers[index]!; if (offer.status !== "draft") throw new AcquisitionDomainError("ACQUISITION_OFFER_NOT_EDITABLE"); this.assertOfferRoute(offer.route, input.sourceAnalysis.route); const updated = Object.freeze({ ...offer, sourceAnalysis: cloneSource(input.sourceAnalysis) }); this.mutateCommercial("offer-draft-rebased", context, { offers: this.replaceOffer(index, updated) }, { offerId: offer.id.value }); }
  public submitOffer(input: Readonly<{ offerId: AcquisitionOfferId; context: AcquisitionCommandContextInput }>): void { const context = createAcquisitionCommandContext(input.context); this.assertExpectedVersion(context.expectedPipelineVersion); const index = this.offerIndex(input.offerId), offer = this.state.offers[index]!; if (offer.status !== "draft") throw new AcquisitionDomainError("ACQUISITION_OFFER_NOT_SUBMITTABLE"); if (this.state.currentStage !== "offer-preparation") throw new AcquisitionDomainError("ACQUISITION_COMMERCIAL_STAGE_REQUIREMENTS_INCOMPLETE"); if (offer.terms.expiration && offer.terms.expiration.getTime() < context.occurredAt.getTime()) throw new AcquisitionDomainError("ACQUISITION_OFFER_EXPIRATION_INVALID"); const submitted = Object.freeze({ ...offer, status: "submitted" as const, submittedAt: new Date(context.occurredAt), current: true }); const version = this.state.version.next(), transitionId = createAcquisitionStageTransitionId(); const history = this.historyEntry(transitionId, "offer-submitted", context, "forward", version); const activity = this.activityEntry(transitionId, "offer-submitted", context, version, { offerId: offer.id.value }, this.state.currentStage, "offer-submitted"); this.state = { ...this.state, currentStage: "offer-submitted", offers: this.replaceOffer(index, submitted), currentOfferId: offer.id, history: Object.freeze([...this.state.history, history]), activity: Object.freeze([...this.state.activity, activity]), version }; }
  public withdrawOffer(input: Readonly<{ offerId: AcquisitionOfferId; context: AcquisitionCommandContextInput; reason?: string }>): void { this.changeOfferStatus(input.offerId, "withdrawn", "offer-withdrawn", input.context, input.reason); }
  public expireOffer(input: Readonly<{ offerId: AcquisitionOfferId; context: AcquisitionCommandContextInput }>): void { const offer = this.getOffer(input.offerId); const context = createAcquisitionCommandContext(input.context); if (!offer.terms.expiration || context.occurredAt.getTime() < offer.terms.expiration.getTime()) throw new AcquisitionDomainError("ACQUISITION_OFFER_EXPIRATION_INVALID"); this.changeOfferStatus(input.offerId, "expired", "offer-expired", input.context); }
  public recordOfferRejection(input: ResponseCommand): void { this.recordResponse(input, "rejected", "offer-rejected"); }
  public recordCounteroffer(input: ResponseCommand): void { const response = input.response; if (response.type !== "counter" || !response.terms) throw new AcquisitionDomainError("ACQUISITION_COUNTEROFFER_INVALID"); const offer = this.getOffer(input.offerId); if (offer.status !== "submitted" && offer.status !== "countered") throw new AcquisitionDomainError("ACQUISITION_COUNTEROFFER_INVALID"); validateAcquisitionOfferTerms(response.terms); const context = createAcquisitionCommandContext(input.context), counter: CounterpartyResponse = Object.freeze({ ...response, offerId: offer.id, recordedAt: new Date(context.occurredAt), recordedBy: { ...context.actor }, terms: cloneTerms(response.terms) }); const version = this.state.version.next(), responses = Object.freeze([...this.state.responses, counter]), updated = Object.freeze({ ...offer, status: "countered" as const, current: true }); if (this.state.currentStage === "offer-submitted") { const transitionId = createAcquisitionStageTransitionId(); this.state = { ...this.state, currentStage: "negotiating", offers: this.replaceOffer(this.offerIndex(offer.id), updated), responses, currentOfferId: offer.id, history: Object.freeze([...this.state.history, this.historyEntry(transitionId, "negotiating", context, "forward", version)]), activity: Object.freeze([...this.state.activity, this.activityEntry(transitionId, "offer-countered", context, version, { offerId: offer.id.value, responseId: counter.id.value }, "offer-submitted", "negotiating")]), version }; } else this.mutateCommercial("offer-countered", context, { offers: this.replaceOffer(this.offerIndex(offer.id), updated), responses }, { offerId: offer.id.value, responseId: counter.id.value }); }
  public recordOfferAcceptance(input: ResponseCommand): void { this.acceptResponse(input, false); }
  public acceptCounteroffer(input: Readonly<{ offerId: AcquisitionOfferId; responseId: CounterpartyResponseId; context: AcquisitionCommandContextInput }>): void { const response = this.state.responses.find(value => value.id.equals(input.responseId) && value.offerId.equals(input.offerId) && value.type === "counter"); if (!response) throw new AcquisitionDomainError("ACQUISITION_ACCEPTANCE_INVALID"); this.acceptResponse({ offerId: input.offerId, response: { ...response, type: "acceptance" }, context: input.context }, true, response); }
  public recordContract(input: Readonly<{ id?: AcquisitionContractId; source: AcquisitionContractSource; terms: AcquisitionContractTerms; context: AcquisitionCommandContextInput }>): AcquisitionContract { const context = createAcquisitionCommandContext(input.context); this.assertExpectedVersion(context.expectedPipelineVersion); this.ensureCommerciallyActive(); if (this.state.contract) throw new AcquisitionDomainError("ACQUISITION_CONTRACT_ALREADY_EXISTS"); validateAcquisitionContractTerms(input.terms); if (input.terms.route !== this.route) throw new AcquisitionDomainError("ACQUISITION_CONTRACT_ROUTE_MISMATCH"); this.validateContractSource(input.source); if (input.source.type === "external-agreement" && !["offer-submitted", "negotiating", "under-contract"].includes(this.state.currentStage)) throw new AcquisitionDomainError("ACQUISITION_COMMERCIAL_STAGE_REQUIREMENTS_INCOMPLETE"); const contract: AcquisitionContract = Object.freeze({ id: input.id ?? createAcquisitionContractId(), pipelineId: this.id, route: input.terms.route, status: "recorded", source: Object.freeze({ ...input.source }), terms: cloneContractTerms(input.terms), recordedBy: { ...context.actor }, recordedAt: new Date(context.occurredAt) }); const moveToContract = input.source.type === "external-agreement" && (this.state.currentStage === "offer-submitted" || this.state.currentStage === "negotiating"); if (moveToContract) { const version = this.state.version.next(), id = createAcquisitionStageTransitionId(); this.state = { ...this.state, currentStage: "under-contract", contract, history: Object.freeze([...this.state.history, this.historyEntry(id, "under-contract", context, "forward", version)]), activity: Object.freeze([...this.state.activity, this.activityEntry(id, "external-contract-recorded", context, version, { contractId: contract.id.value }, this.state.currentStage, "under-contract")]), version }; } else this.mutateCommercial(input.source.type === "external-agreement" ? "external-contract-recorded" : "contract-recorded", context, { contract }, { contractId: contract.id.value }); return cloneContract(contract); }

  private ensureCommerciallyActive() { if (this.isTerminal()) throw new AcquisitionDomainError("ACQUISITION_PIPELINE_TERMINAL", { stage: this.state.currentStage }); }
  private assertOfferRoute(expected: InvestmentOpportunityRoute, actual: InvestmentOpportunityRoute) { if (expected !== actual || actual !== this.route) throw new AcquisitionDomainError("ACQUISITION_OFFER_ROUTE_MISMATCH", { expected, actual }); }
  private offerIndex(id: AcquisitionOfferId) { const index = this.state.offers.findIndex(value => value.id.equals(id)); if (index < 0) throw new AcquisitionDomainError("ACQUISITION_OFFER_NOT_FOUND", { offerId: id.value }); return index; }
  private getOffer(id: AcquisitionOfferId) { return this.state.offers[this.offerIndex(id)]!; }
  private replaceOffer(index: number, offer: AcquisitionOffer) { const offers = [...this.state.offers]; offers[index] = offer; return Object.freeze(offers); }
  private mutateCommercial(type: AcquisitionActivity["type"], context: ReturnType<typeof createAcquisitionCommandContext>, patch: Partial<PipelineState>, details: Record<string, unknown>) { const version = this.state.version.next(), id = createAcquisitionStageTransitionId(); const activity = this.activityEntry(id, type, context, version, details, undefined, this.state.currentStage); this.state = { ...this.state, ...patch, offers: patch.offers ?? this.state.offers, responses: patch.responses ?? this.state.responses, version, activity: Object.freeze([...this.state.activity, activity]) }; }
  private changeOfferStatus(id: AcquisitionOfferId, status: AcquisitionOffer["status"], type: AcquisitionActivity["type"], contextInput: AcquisitionCommandContextInput, reason?: string) { const context = createAcquisitionCommandContext(contextInput); this.assertExpectedVersion(context.expectedPipelineVersion); const index = this.offerIndex(id), offer = this.state.offers[index]!; if (["accepted", "rejected", "expired", "superseded"].includes(offer.status)) throw new AcquisitionDomainError("ACQUISITION_OFFER_ALREADY_RESPONDED"); if (status === "withdrawn" && offer.status === "submitted" && !reason?.trim()) throw new AcquisitionDomainError("ACQUISITION_OFFER_NOT_EDITABLE"); this.ensureCommerciallyActive(); const updated = Object.freeze({ ...offer, status, current: false }); this.mutateCommercial(type, context, { offers: this.replaceOffer(index, updated), currentOfferId: this.state.currentOfferId?.equals(id) ? undefined : this.state.currentOfferId }, { offerId: id.value, ...(reason ? { reason } : {}) }); }
  private recordResponse(input: ResponseCommand, status: "rejected", type: AcquisitionActivity["type"]) { const offer = this.getOffer(input.offerId); if (offer.status !== "submitted" && offer.status !== "countered") throw new AcquisitionDomainError("ACQUISITION_OFFER_ALREADY_RESPONDED"); if (this.state.responses.some(value => value.id.equals(input.response.id))) throw new AcquisitionDomainError("ACQUISITION_COUNTERPARTY_RESPONSE_INVALID"); const context = createAcquisitionCommandContext(input.context); const response: CounterpartyResponse = Object.freeze({ ...input.response, offerId: offer.id, recordedAt: new Date(context.occurredAt), recordedBy: { ...context.actor } }); this.mutateCommercial(type, context, { offers: this.replaceOffer(this.offerIndex(offer.id), Object.freeze({ ...offer, status, current: false })), responses: Object.freeze([...this.state.responses, response]), currentOfferId: undefined }, { offerId: offer.id.value, responseId: response.id.value }); }
  private acceptResponse(input: ResponseCommand, counter: boolean, sourceCounter?: CounterpartyResponse) { const offer = this.getOffer(input.offerId); if (offer.status !== "submitted" && !(counter && offer.status === "countered")) throw new AcquisitionDomainError("ACQUISITION_ACCEPTANCE_INVALID"); const context = createAcquisitionCommandContext(input.context); const response: CounterpartyResponse = Object.freeze({ ...input.response, offerId: offer.id, type: "acceptance", recordedAt: new Date(context.occurredAt), recordedBy: { ...context.actor } }); const terms = sourceCounter?.terms ?? offer.terms; if (!terms) throw new AcquisitionDomainError("ACQUISITION_ACCEPTANCE_INVALID"); const version = this.state.version.next(), id = createAcquisitionStageTransitionId(), accepted: AcceptedAgreementBasis = Object.freeze({ source: sourceCounter ? "counteroffer" : "offer", offerId: offer.id, ...(sourceCounter ? { responseId: sourceCounter.id } : {}), acceptedTerms: cloneTerms(terms), acceptedAt: new Date(context.occurredAt) }); const updated = Object.freeze({ ...offer, status: "accepted" as const, current: true }); if (this.state.currentStage !== "offer-submitted" && this.state.currentStage !== "negotiating") throw new AcquisitionDomainError("ACQUISITION_COMMERCIAL_STAGE_REQUIREMENTS_INCOMPLETE"); this.state = { ...this.state, currentStage: "under-contract", offers: this.replaceOffer(this.offerIndex(offer.id), updated), responses: Object.freeze([...this.state.responses, response]), currentOfferId: offer.id, acceptedAgreement: accepted, history: Object.freeze([...this.state.history, this.historyEntry(id, "under-contract", context, "forward", version)]), activity: Object.freeze([...this.state.activity, this.activityEntry(id, counter ? "counteroffer-accepted" : "offer-accepted", context, version, { offerId: offer.id.value, responseId: response.id.value }, this.state.currentStage, "under-contract")]), version }; }
  private validateContractSource(source: AcquisitionContractSource) { if (source.type === "external-agreement" && !source.explanation.trim()) throw new AcquisitionDomainError("ACQUISITION_CONTRACT_SOURCE_INVALID"); if (source.type === "accepted-offer" && this.getOffer(source.offerId).status !== "accepted") throw new AcquisitionDomainError("ACQUISITION_CONTRACT_SOURCE_INVALID"); if (source.type === "accepted-counteroffer" && !this.state.responses.some(value => value.id.equals(source.responseId) && value.type === "counter")) throw new AcquisitionDomainError("ACQUISITION_CONTRACT_SOURCE_INVALID"); }
  private historyEntry(id: AcquisitionStageTransitionId, to: AcquisitionStage, context: ReturnType<typeof createAcquisitionCommandContext>, classification: AcquisitionTransitionClassification, version: AcquisitionPipelineVersion): AcquisitionStageHistoryEntry { return Object.freeze({ transitionId: id, from: this.state.currentStage, to, occurredAt: new Date(context.occurredAt), actor: { ...context.actor }, classification, aggregateVersion: version }); }
  private activityEntry(id: AcquisitionStageTransitionId, type: AcquisitionActivity["type"], context: ReturnType<typeof createAcquisitionCommandContext>, version: AcquisitionPipelineVersion, details: Record<string, unknown>, from?: AcquisitionStage, to: AcquisitionStage = this.state.currentStage): AcquisitionActivity { return Object.freeze({ id, type, occurredAt: new Date(context.occurredAt), actor: { ...context.actor }, details: Object.freeze(details), aggregateVersion: version, ...(from ? { from } : {}), to }); }

  private assertExpectedVersion(expected: AcquisitionPipelineVersion | undefined): void { if (!expected || !expected.equals(this.state.version)) throw new AcquisitionDomainError("INVALID_ACQUISITION_PIPELINE_VERSION", { expected: expected?.value, actual: this.state.version.value }); }
  private applyTransition(to: AcquisitionStage, occurredAt: Date, actor: AcquisitionActorReference, classification: AcquisitionTransitionClassification, reason?: AcquisitionTransitionReason, commandId?: string, activityType: AcquisitionActivity["type"] = "stage-transitioned", details: Record<string, unknown> = {}): void {
    if (occurredAt.getTime() < this.state.history[this.state.history.length - 1]!.occurredAt.getTime()) throw new AcquisitionDomainError("INVALID_ACQUISITION_COMMAND_CONTEXT");
    const version = this.state.version.next(), transitionId = createAcquisitionStageTransitionId();
    const entry: AcquisitionStageHistoryEntry = Object.freeze({ transitionId, from: this.state.currentStage, to, occurredAt: new Date(occurredAt), actor: { ...actor }, classification, ...(reason ? { reason: { ...reason } } : {}), aggregateVersion: version });
    const activity: AcquisitionActivity = Object.freeze({ id: transitionId, type: activityType, occurredAt: new Date(occurredAt), actor: { ...actor }, details: Object.freeze({ ...details, ...(commandId ? { commandId } : {}) }), aggregateVersion: version, from: this.state.currentStage, to });
    this.state = { ...this.state, currentStage: to, history: Object.freeze([...this.state.history, entry]), activity: Object.freeze([...this.state.activity, activity]), version };
  }
}

function cloneState(state: PipelineState): PipelineState { return { ...state, activation: cloneActivation(state.activation), history: Object.freeze(state.history.map(cloneHistory)), activity: Object.freeze(state.activity.map(cloneActivity)), version: AcquisitionPipelineVersion.from(state.version.value), offers: Object.freeze(state.offers.map(cloneOffer)), responses: Object.freeze(state.responses.map(cloneResponse)), ...(state.acceptedAgreement ? { acceptedAgreement: cloneAgreement(state.acceptedAgreement) } : {}), ...(state.contract ? { contract: cloneContract(state.contract) } : {}) }; }
function cloneActivation(value: PipelineActivation): PipelineActivation { return { ...value, activatedAt: new Date(value.activatedAt), activatedBy: { ...value.activatedBy }, sourceAnalysis: { ...value.sourceAnalysis, analyzedAt: new Date(value.sourceAnalysis.analyzedAt) } }; }
function cloneHistory(value: AcquisitionStageHistoryEntry): AcquisitionStageHistoryEntry { return { ...value, occurredAt: new Date(value.occurredAt), actor: { ...value.actor }, ...(value.reason ? { reason: { ...value.reason } } : {}), aggregateVersion: AcquisitionPipelineVersion.from(value.aggregateVersion.value) }; }
function cloneActivity(value: AcquisitionActivity): AcquisitionActivity { return { ...value, occurredAt: new Date(value.occurredAt), actor: { ...value.actor }, details: { ...value.details }, aggregateVersion: AcquisitionPipelineVersion.from(value.aggregateVersion.value) }; }
function cloneSource(value: OfferSourceAnalysisReference): OfferSourceAnalysisReference { return { ...value, analyzedAt: new Date(value.analyzedAt) }; }
function cloneTerms<T extends AcquisitionOfferTerms>(value: T): T { return structuredClone(value); }
function cloneOffer(value: AcquisitionOffer): AcquisitionOffer { return { ...value, sequence: { ...value.sequence }, sourceAnalysis: cloneSource(value.sourceAnalysis), terms: cloneTerms(value.terms), createdAt: new Date(value.createdAt), ...(value.submittedAt ? { submittedAt: new Date(value.submittedAt) } : {}), createdBy: { ...value.createdBy } }; }
function cloneResponse(value: CounterpartyResponse): CounterpartyResponse { return { ...value, counterparty: { ...value.counterparty }, respondedAt: new Date(value.respondedAt), recordedAt: new Date(value.recordedAt), recordedBy: { ...value.recordedBy }, ...(value.terms ? { terms: cloneTerms(value.terms) } : {}) }; }
function cloneAgreement(value: AcceptedAgreementBasis): AcceptedAgreementBasis { return { ...value, acceptedTerms: cloneTerms(value.acceptedTerms), acceptedAt: new Date(value.acceptedAt) }; }
function cloneContractTerms<T extends AcquisitionContractTerms>(value: T): T { return structuredClone(value); }
function cloneContract(value: AcquisitionContract): AcquisitionContract { return { ...value, source: { ...value.source }, terms: cloneContractTerms(value.terms), recordedAt: new Date(value.recordedAt), recordedBy: { ...value.recordedBy } }; }
