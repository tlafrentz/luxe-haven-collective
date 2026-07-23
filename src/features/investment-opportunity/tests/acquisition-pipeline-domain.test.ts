import { describe, expect, it } from "vitest";
import {
  ACQUISITION_STAGES,
  ACQUISITION_STAGE_TO_OPPORTUNITY_STATUS,
  INITIAL_ACQUISITION_STAGE,
  TERMINAL_ACQUISITION_STAGES,
  AcquisitionDomainError,
  AcquisitionPipelineVersion,
  assertAcquisitionRouteMatches,
  assessAcquisitionStageTransition,
  canTransitionAcquisitionStage,
  createAcquisitionActorReference,
  createAcquisitionCommandId,
  createAcquisitionCommandContext,
  createAcquisitionExit,
  createAcquisitionPipelineId,
  createAcquisitionTransitionReason,
  createPipelineActivation,
  deriveOpportunityStatusFromAcquisitionStage,
  getAcquisitionStageDefinition,
  getAcquisitionTransitionRequirements,
  getAllowedAcquisitionStageTransitions,
  isAcquisitionExitReasonApplicable,
  isAcquisitionStage,
  isActiveAcquisitionStage,
  isSupportedAcquisitionPipelineRoute,
} from "../acquisition-pipeline";
import { createOpportunityAnalysisId } from "../domain";

const actor = createAcquisitionActorReference({ type: "user", id: "user-1" });
const date = new Date("2026-07-22T12:00:00.000Z");

describe("acquisition pipeline primitives", () => {
  it("creates distinct, reconstructable platform-kernel identifiers", () => {
    const value = createAcquisitionPipelineId("acquisition-pipeline-one");
    expect(value.toString()).toBe("acquisition-pipeline-one");
    expect(value.equals(createAcquisitionPipelineId("acquisition-pipeline-one"))).toBe(true);
    expect(createAcquisitionCommandId("acquisition-command-one").toJSON()).toBe("acquisition-command-one");
    expect(() => createAcquisitionPipelineId("wrong-one")).toThrowError(AcquisitionDomainError);
  });

  it("validates the canonical stage vocabulary and metadata", () => {
    expect(ACQUISITION_STAGES).toHaveLength(9);
    for (const stage of ACQUISITION_STAGES) {
      expect(isAcquisitionStage(stage)).toBe(true);
      expect(getAcquisitionStageDefinition(stage).stage).toBe(stage);
    }
    expect(isAcquisitionStage(" Pursuit ")).toBe(false);
    expect(isActiveAcquisitionStage("pursuit")).toBe(true);
    expect(TERMINAL_ACQUISITION_STAGES).toEqual(["closed-acquired", "exited"]);
    expect(INITIAL_ACQUISITION_STAGE).toBe("pursuit");
  });

  it("enforces the explicit transition graph and classifications", () => {
    expect(canTransitionAcquisitionStage("pursuit", "offer-preparation")).toBe(true);
    expect(canTransitionAcquisitionStage("pursuit", "closing-preparation")).toBe(false);
    expect(canTransitionAcquisitionStage("closed-acquired", "exited")).toBe(false);
    expect(assessAcquisitionStageTransition("offer-preparation", "pursuit")).toMatchObject({ allowed: true, classification: "backward", reasonRequired: true });
    expect(assessAcquisitionStageTransition("pursuit", "exited")).toMatchObject({ allowed: true, classification: "terminal", reasonRequired: false });
    expect(assessAcquisitionStageTransition("closing-preparation", "closed-acquired")).toMatchObject({ allowed: true, classification: "terminal" });
    expect(assessAcquisitionStageTransition("pursuit", "pursuit").allowed).toBe(false);
  });

  it("returns immutable policy collections and future-fact requirements", () => {
    const transitions = getAllowedAcquisitionStageTransitions("pursuit");
    expect(transitions).toEqual(["offer-preparation", "exited"]);
    expect(Object.isFrozen(transitions)).toBe(true);
    expect(getAcquisitionTransitionRequirements("offer-submitted", "under-contract")).toMatchObject({ acceptedAgreementRequired: true });
    expect(getAcquisitionTransitionRequirements("closing-preparation", "closed-acquired")).toMatchObject({ closingFactsRequired: true, closingReadinessRequired: true });
  });

  it("normalizes backward reasons and requires an explanation for other", () => {
    expect(createAcquisitionTransitionReason({ code: "operator-correction", explanation: " corrected " })).toEqual({ code: "operator-correction", explanation: "corrected" });
    expect(() => createAcquisitionTransitionReason({ code: "other" })).toThrowError(AcquisitionDomainError);
    expect(() => createAcquisitionTransitionReason({ code: "other", explanation: "   " })).toThrowError("ACQUISITION_TRANSITION_EXPLANATION_REQUIRED");
  });

  it("supports only canonical acquisition routes and rejects mismatches", () => {
    expect(isSupportedAcquisitionPipelineRoute("purchase")).toBe(true);
    expect(isSupportedAcquisitionPipelineRoute("rental-arbitrage")).toBe(true);
    expect(isSupportedAcquisitionPipelineRoute("lease-to-own")).toBe(false);
    expect(() => assertAcquisitionRouteMatches("purchase", "rental-arbitrage")).toThrowError("ACQUISITION_ROUTE_MISMATCH");
  });

  it("creates immutable activation lineage with a completed source analysis", () => {
    const activation = createPipelineActivation({ activatedAt: date, activatedBy: actor, sourceAnalysis: { analysisId: createOpportunityAnalysisId("opportunity-analysis-one"), analysisVersion: 2, analyzedAt: new Date(date.getTime() - 1000), route: "purchase", assumptionFingerprint: "fp-1" } });
    expect(activation.sourceAnalysis.analysisVersion).toBe(2);
    expect(Object.isFrozen(activation)).toBe(true);
    expect(() => createPipelineActivation({ activatedAt: new Date(date.getTime() - 2000), activatedBy: actor, sourceAnalysis: activation.sourceAnalysis })).toThrowError("INVALID_PIPELINE_ACTIVATION");
  });

  it("validates actor, version, and command context without inventing time", () => {
    expect(createAcquisitionActorReference({ type: "system", id: "acquisition-pipeline" }).type).toBe("system");
    expect(() => createAcquisitionActorReference({ type: "user", id: " " })).toThrowError("INVALID_ACQUISITION_ACTOR");
    const version = AcquisitionPipelineVersion.initial();
    expect(version.next().value).toBe(2);
    expect(() => AcquisitionPipelineVersion.from(0)).toThrowError("INVALID_ACQUISITION_PIPELINE_VERSION");
    const context = createAcquisitionCommandContext({ commandId: createAcquisitionCommandId("acquisition-command-one"), actor, occurredAt: date, expectedPipelineVersion: version, expectedOpportunityVersion: 3 });
    expect(context.occurredAt).toEqual(date);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("enforces route-aware terminal exit semantics", () => {
    expect(isAcquisitionExitReasonApplicable("purchase", "appraisal-failed")).toBe(true);
    expect(isAcquisitionExitReasonApplicable("rental-arbitrage", "appraisal-failed")).toBe(false);
    expect(isAcquisitionExitReasonApplicable("rental-arbitrage", "inspection-failed")).toBe(true);
    const exit = createAcquisitionExit({ route: "purchase", reason: "operator-withdrew", exitedFromStage: "pursuit", exitedAt: date, exitedBy: actor, reconsideration: { eligible: false } });
    expect(exit.exitedFromStage).toBe("pursuit");
    expect(() => createAcquisitionExit({ route: "purchase", reason: "other", exitedFromStage: "pursuit", exitedAt: date, exitedBy: actor, reconsideration: { eligible: false } })).toThrowError("ACQUISITION_EXIT_EXPLANATION_REQUIRED");
    expect(() => createAcquisitionExit({ route: "purchase", reason: "operator-withdrew", exitedFromStage: "closed-acquired" as "pursuit", exitedAt: date, exitedBy: actor, reconsideration: { eligible: false } })).toThrowError("INVALID_ACQUISITION_EXIT");
  });

  it("exhaustively synchronizes every stage to the existing Opportunity status", () => {
    for (const stage of ACQUISITION_STAGES) expect(deriveOpportunityStatusFromAcquisitionStage(stage)).toBe(ACQUISITION_STAGE_TO_OPPORTUNITY_STATUS[stage]);
    expect(deriveOpportunityStatusFromAcquisitionStage("pursuit")).toBe("shortlisted");
    expect(deriveOpportunityStatusFromAcquisitionStage("closed-acquired")).toBe("acquired");
    expect(deriveOpportunityStatusFromAcquisitionStage("exited")).toBe("rejected");
    expect(Object.isFrozen(ACQUISITION_STAGE_TO_OPPORTUNITY_STATUS)).toBe(true);
  });
});
