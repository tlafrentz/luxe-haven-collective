import { describe, expect, it } from "vitest";
import { mapMarketPlatformArtifacts } from "../mappers/map-market-platform-artifacts";
import { createMarketAnalysisReport } from "./market-observation-test-fixtures";

describe("Market Platform artifact mapper", () => {
  it("emits the canonical reasoning and intelligence lifecycle", () => {
    const report = createMarketAnalysisReport();
    const artifacts = mapMarketPlatformArtifacts(report);

    expect(artifacts.observations.size).toBeGreaterThan(0);
    expect(artifacts.evidence.size).toBe(report.evidence.length);
    expect(artifacts.claims.size).toBe(report.findings.length);
    expect(artifacts.evaluations.size).toBe(report.findings.length);
    expect(artifacts.recommendations.size).toBeGreaterThan(0);
    expect(artifacts.outcome.lineage.observationIds).toHaveLength(artifacts.observations.size);
    expect(artifacts.intelligence.insights).toHaveLength(1);
    expect(artifacts.intelligence.opportunities).toHaveLength(1);
    expect(artifacts.intelligence.forecasts).toHaveLength(1);
    expect(artifacts.intelligence.anomalies).toHaveLength(1);
  });
});
