import { describe, expect, it } from "vitest";
import { mapAcquisitionPipelineCoreFromPersistence, mapAcquisitionStageHistoryRow, mapAcquisitionActivityRow } from "./acquisition-pipeline-core-mapper";

const row = { id: "acquisition-pipeline-1", opportunity_id: "investment-opportunity-1", owner_id: "owner-1", route: "purchase", stage: "pursuit", activation: { activated_at: "2026-01-01T00:00:00.000Z", activated_by: { type: "user", id: "owner-1" }, source_analysis: { analysis_id: "opportunity-analysis-1", analysis_version: 1, analyzed_at: "2025-12-31T00:00:00.000Z", route: "purchase" } }, version: 1, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" } as const;
const history = [{ transition_id: "acquisition-stage-transition-1", pipeline_id: row.id, from_stage: null, to_stage: "pursuit", occurred_at: row.created_at, actor: { type: "user", id: "owner-1" }, classification: "forward" as const, aggregate_version: 1 }];
const activity = [{ id: "acquisition-stage-transition-1", pipeline_id: row.id, type: "pipeline-activated", occurred_at: row.created_at, actor: { type: "user", id: "owner-1" }, details: { route: "purchase" }, aggregate_version: 1, from_stage: null, to_stage: "pursuit" }];

describe("acquisition pipeline core persistence mapper", () => {
  it("restores the complete core state and preserves ordering", () => { const props = mapAcquisitionPipelineCoreFromPersistence(row, history, activity); expect(props.id.value).toBe(row.id); expect(props.opportunityId.value).toBe(row.opportunity_id); expect(props.route).toBe("purchase"); expect(props.currentStage).toBe("pursuit"); expect(props.version.value).toBe(1); expect(props.activation.sourceAnalysis.analysisId.value).toBe("opportunity-analysis-1"); expect(props.history).toHaveLength(1); expect(props.activity).toHaveLength(1); });
  it("rejects unsupported persisted values", () => { expect(() => mapAcquisitionPipelineCoreFromPersistence({ ...row, route: "unknown" }, history, activity)).toThrowError(); expect(() => mapAcquisitionPipelineCoreFromPersistence({ ...row, version: 0 }, history, activity)).toThrowError(); });
  it("maps history and activity rows explicitly", () => { expect(mapAcquisitionStageHistoryRow(history[0]).to).toBe("pursuit"); expect(mapAcquisitionActivityRow(activity[0]).type).toBe("pipeline-activated"); });
});
