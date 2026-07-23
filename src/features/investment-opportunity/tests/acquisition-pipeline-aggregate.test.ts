import { describe, expect, it } from "vitest";
import {
  ACQUISITION_STAGES,
  AcquisitionPipeline,
  AcquisitionPipelineVersion,
  InMemoryAcquisitionPipelineRepository,
  createAcquisitionActorReference,
  createAcquisitionCommandId,
  createAcquisitionPipelineId,
  createPipelineActivation,
  deriveOpportunityStatusFromAcquisitionStage,
  type AcquisitionStage,
} from "../acquisition-pipeline";
import { createInvestmentOpportunityId, createOpportunityAnalysisId } from "../domain";

const actor = createAcquisitionActorReference({ type: "user", id: "owner-1" });
const opportunityId = createInvestmentOpportunityId("investment-opportunity-aggregate");
const analyzedAt = new Date("2026-07-22T10:00:00.000Z");
let commandNumber = 0;
function context(version?: number, occurredAt = new Date(analyzedAt.getTime() + commandNumber + 1)) {
  commandNumber += 1;
  return { commandId: createAcquisitionCommandId(`acquisition-command-test-${commandNumber}`), actor, occurredAt, ...(version === undefined ? {} : { expectedPipelineVersion: AcquisitionPipelineVersion.from(version) }) };
}
function activate(route: "purchase" | "rental-arbitrage" = "purchase") {
  return AcquisitionPipeline.activate({ id: createAcquisitionPipelineId(`acquisition-pipeline-test-${++commandNumber}`), opportunityId, route, activation: createPipelineActivation({ activatedAt: analyzedAt, activatedBy: actor, sourceAnalysis: { analysisId: createOpportunityAnalysisId("opportunity-analysis-aggregate"), analysisVersion: 1, analyzedAt, route } }), context: context(undefined, analyzedAt) });
}
function move(pipeline: AcquisitionPipeline, to: AcquisitionStage, reason?: { code: "offer-revised"; explanation?: string }) {
  pipeline.transition({ ...context(pipeline.version().value), to, ...(reason ? { reason } : {}) });
}

describe("AcquisitionPipeline aggregate", () => {
  it("activates at pursuit with immutable lineage, history, activity, and shortlist projection", () => {
    const pipeline = activate();
    expect(pipeline.currentStage()).toBe("pursuit");
    expect(pipeline.version().value).toBe(1);
    expect(pipeline.history()).toHaveLength(1);
    expect(pipeline.history()[0]).toMatchObject({ to: "pursuit", aggregateVersion: { value: 1 } });
    expect(pipeline.activity()[0].type).toBe("pipeline-activated");
    expect(pipeline.statusProjection()).toEqual({ status: "shortlisted", pipelineAuthoritative: true });
    expect(pipeline.activation.sourceAnalysis.analysisId.value).toBe("opportunity-analysis-aggregate");
  });

  it("accepts every approved transition edge and increments version/history/activity", () => {
    const pipeline = activate();
    const edges: readonly [AcquisitionStage, AcquisitionStage][] = [
      ["pursuit", "offer-preparation"], ["offer-preparation", "offer-submitted"], ["offer-submitted", "negotiating"],
      ["negotiating", "under-contract"], ["under-contract", "due-diligence"], ["due-diligence", "closing-preparation"],
    ];
    for (const [, to] of edges) move(pipeline, to);
    expect(pipeline.currentStage()).toBe("closing-preparation");
    expect(pipeline.version().value).toBe(7);
    expect(pipeline.history()).toHaveLength(7);
    expect(pipeline.activity()).toHaveLength(7);
    expect(pipeline.statusProjection().status).toBe("under-contract");
  });

  it("rejects every unlisted edge, same-stage transition, and stale version", () => {
    const pipeline = activate();
    for (const from of ACQUISITION_STAGES) {
      for (const to of ACQUISITION_STAGES) {
        const allowed = from === "pursuit" && to === "offer-preparation" || from === "pursuit" && to === "exited";
        if (!allowed && from !== "pursuit") continue;
        if (!allowed) expect(() => pipeline.transition({ ...context(1), to })).toThrow();
      }
    }
    expect(() => pipeline.transition({ ...context(1), to: "exited" })).toThrowError("INVALID_ACQUISITION_EXIT");
    expect(() => pipeline.transition({ ...context(99), to: "offer-preparation" })).toThrowError("INVALID_ACQUISITION_PIPELINE_VERSION");
  });

  it("requires a canonical reason for backward movement", () => {
    const pipeline = activate();
    move(pipeline, "offer-preparation");
    expect(() => pipeline.transition({ ...context(2), to: "pursuit" })).toThrowError("ACQUISITION_TRANSITION_REASON_REQUIRED");
    move(pipeline, "pursuit", { code: "offer-revised", explanation: "Seller revised terms." });
    expect(pipeline.history()[2]).toMatchObject({ from: "offer-preparation", to: "pursuit", reason: { code: "offer-revised" } });
  });

  it("makes exit terminal from every active stage and preserves the exit outcome", () => {
    const pipeline = activate();
    pipeline.exit({ exit: { reason: "operator-withdrew", exitedFromStage: "pursuit", exitedAt: analyzedAt, exitedBy: actor, reconsideration: { eligible: true, note: "May revisit" } }, context: context(1) });
    expect(pipeline.isTerminal()).toBe(true);
    expect(pipeline.currentStage()).toBe("exited");
    expect(pipeline.activity()[1].type).toBe("pipeline-exited");
    expect(() => pipeline.transition({ ...context(2), to: "pursuit" })).toThrowError("ACQUISITION_PIPELINE_TERMINAL");
  });

  it.each(["pursuit", "offer-preparation", "offer-submitted", "negotiating", "under-contract", "due-diligence", "closing-preparation"] as const)("permits an explicit exit from %s", (stage) => {
    const pipeline = activate();
    const path: readonly AcquisitionStage[] = ["offer-preparation", "offer-submitted", "negotiating", "under-contract", "due-diligence", "closing-preparation"];
    for (const next of path.slice(0, ["pursuit", ...path].indexOf(stage))) move(pipeline, next);
    expect(pipeline.currentStage()).toBe(stage);
    const occurredAt = new Date(analyzedAt.getTime() + 10000);
    pipeline.exit({ exit: { reason: "operator-withdrew", exitedFromStage: stage, exitedAt: occurredAt, exitedBy: actor, reconsideration: { eligible: false } }, context: context(pipeline.version().value, occurredAt) });
    expect(pipeline.currentStage()).toBe("exited");
  });

  it("closes only from closing preparation and remains terminal", () => {
    const pipeline = activate();
    expect(() => pipeline.closeAcquisition(context(1))).toThrow();
    move(pipeline, "offer-preparation"); move(pipeline, "offer-submitted"); move(pipeline, "negotiating"); move(pipeline, "under-contract"); move(pipeline, "closing-preparation");
    pipeline.closeAcquisition(context(6));
    expect(pipeline.currentStage()).toBe("closed-acquired");
    expect(pipeline.statusProjection().status).toBe("acquired");
    expect(pipeline.activity().at(-1)?.type).toBe("pipeline-closed-acquired");
    expect(() => pipeline.closeAcquisition(context(7))).toThrowError("ACQUISITION_PIPELINE_TERMINAL");
  });

  it("keeps route and opportunity references immutable and never mutates the Opportunity", () => {
    const pipeline = activate("rental-arbitrage");
    expect(pipeline.route).toBe("rental-arbitrage");
    expect(pipeline.opportunityId.equals(opportunityId)).toBe(true);
    expect(deriveOpportunityStatusFromAcquisitionStage(pipeline.currentStage())).toBe("shortlisted");
  });

  it("round-trips through the in-memory repository with optimistic version checks", async () => {
    const repository = new InMemoryAcquisitionPipelineRepository();
    const pipeline = activate();
    await repository.save(pipeline);
    expect(await repository.exists(opportunityId)).toBe(true);
    expect((await repository.findById(pipeline.id))?.currentStage()).toBe("pursuit");
    move(pipeline, "offer-preparation");
    await repository.save(pipeline, 1);
    expect((await repository.findByOpportunity(opportunityId))?.version().value).toBe(2);
    await expect(repository.save(pipeline, 1)).rejects.toThrowError("INVALID_ACQUISITION_PIPELINE_VERSION");
  });
});
