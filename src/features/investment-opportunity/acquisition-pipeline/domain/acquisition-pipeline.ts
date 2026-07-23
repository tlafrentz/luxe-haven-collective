import type { InvestmentOpportunityId, InvestmentOpportunityRoute, OpportunityStatus, OpportunityAnalysisId } from "@/features/investment-opportunity/domain";
import { createAcquisitionActorReference, type AcquisitionActorReference } from "./acquisition-actor-reference";
import { createAcquisitionCommandContext, type AcquisitionCommandContextInput } from "./acquisition-command-context";
import { createAcquisitionExit, type AcquisitionExit } from "./acquisition-exit";
import { AcquisitionDomainError } from "./errors";
import { createAcquisitionPipelineId, createAcquisitionStageTransitionId, type AcquisitionPipelineId, type AcquisitionStageTransitionId } from "./identifiers";
import { createPipelineActivation, type PipelineActivation } from "./pipeline-activation";
import { AcquisitionPipelineVersion } from "./acquisition-pipeline-version";
import { assessAcquisitionStageTransition, type AcquisitionTransitionClassification } from "./acquisition-stage-policy";
import { type AcquisitionStage } from "./acquisition-stage";
import { createAcquisitionTransitionReason, type AcquisitionTransitionReason } from "./acquisition-transition";
import { deriveOpportunityStatusFromAcquisitionStage } from "./opportunity-status-synchronization";
import { assertSupportedAcquisitionPipelineRoute } from "./acquisition-route-policy";
import type { AcquisitionActivity } from "./acquisition-activity";
import type { AcquisitionStageHistoryEntry } from "./acquisition-stage-history";

type PipelineState = Readonly<{
  id: AcquisitionPipelineId;
  opportunityId: InvestmentOpportunityId;
  route: InvestmentOpportunityRoute;
  activation: PipelineActivation;
  currentStage: AcquisitionStage;
  history: readonly AcquisitionStageHistoryEntry[];
  activity: readonly AcquisitionActivity[];
  version: AcquisitionPipelineVersion;
}>;

export type AcquisitionPipelineProps = Readonly<PipelineState>;
export type AcquisitionSynchronizationProjection = Readonly<{ status: OpportunityStatus; pipelineAuthoritative: true }>;
export type AcquisitionPipelineTransitionInput = Readonly<AcquisitionCommandContextInput & { to: AcquisitionStage; reason?: AcquisitionTransitionReason }>;

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
    return new AcquisitionPipeline({ id, opportunityId: input.opportunityId, route: input.route, activation, currentStage: "pursuit", history: Object.freeze([entry]), activity: Object.freeze([activity]), version });
  }

  public static restore(props: AcquisitionPipelineProps): AcquisitionPipeline {
    if (!props.history.length || props.history[0]?.to !== "pursuit" || props.history[props.history.length - 1]?.to !== props.currentStage || props.history.length !== props.activity.length) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    for (let index = 0; index < props.history.length; index += 1) {
      const entry = props.history[index];
      if (!entry || entry.aggregateVersion.value !== index + 1 || index > 0 && entry.occurredAt.getTime() < props.history[index - 1]!.occurredAt.getTime()) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
    }
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

  private assertExpectedVersion(expected: AcquisitionPipelineVersion | undefined): void { if (!expected || !expected.equals(this.state.version)) throw new AcquisitionDomainError("INVALID_ACQUISITION_PIPELINE_VERSION", { expected: expected?.value, actual: this.state.version.value }); }
  private applyTransition(to: AcquisitionStage, occurredAt: Date, actor: AcquisitionActorReference, classification: AcquisitionTransitionClassification, reason?: AcquisitionTransitionReason, commandId?: string, activityType: AcquisitionActivity["type"] = "stage-transitioned", details: Record<string, unknown> = {}): void {
    if (occurredAt.getTime() < this.state.history[this.state.history.length - 1]!.occurredAt.getTime()) throw new AcquisitionDomainError("INVALID_ACQUISITION_COMMAND_CONTEXT");
    const version = this.state.version.next(), transitionId = createAcquisitionStageTransitionId();
    const entry: AcquisitionStageHistoryEntry = Object.freeze({ transitionId, from: this.state.currentStage, to, occurredAt: new Date(occurredAt), actor: { ...actor }, classification, ...(reason ? { reason: { ...reason } } : {}), aggregateVersion: version });
    const activity: AcquisitionActivity = Object.freeze({ id: transitionId, type: activityType, occurredAt: new Date(occurredAt), actor: { ...actor }, details: Object.freeze({ ...details, ...(commandId ? { commandId } : {}) }), aggregateVersion: version, from: this.state.currentStage, to });
    this.state = { ...this.state, currentStage: to, history: Object.freeze([...this.state.history, entry]), activity: Object.freeze([...this.state.activity, activity]), version };
  }
}

function cloneState(state: PipelineState): PipelineState { return { ...state, activation: cloneActivation(state.activation), history: Object.freeze(state.history.map(cloneHistory)), activity: Object.freeze(state.activity.map(cloneActivity)), version: AcquisitionPipelineVersion.from(state.version.value) }; }
function cloneActivation(value: PipelineActivation): PipelineActivation { return { ...value, activatedAt: new Date(value.activatedAt), activatedBy: { ...value.activatedBy }, sourceAnalysis: { ...value.sourceAnalysis, analyzedAt: new Date(value.sourceAnalysis.analyzedAt) } }; }
function cloneHistory(value: AcquisitionStageHistoryEntry): AcquisitionStageHistoryEntry { return { ...value, occurredAt: new Date(value.occurredAt), actor: { ...value.actor }, ...(value.reason ? { reason: { ...value.reason } } : {}), aggregateVersion: AcquisitionPipelineVersion.from(value.aggregateVersion.value) }; }
function cloneActivity(value: AcquisitionActivity): AcquisitionActivity { return { ...value, occurredAt: new Date(value.occurredAt), actor: { ...value.actor }, details: { ...value.details }, aggregateVersion: AcquisitionPipelineVersion.from(value.aggregateVersion.value) }; }
