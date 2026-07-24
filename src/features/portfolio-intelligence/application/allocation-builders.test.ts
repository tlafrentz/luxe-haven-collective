import { describe, expect, it } from "vitest";
import { Money } from "@/platform/kernel";
import { buildAcquisitionCandidate, buildObligationCandidate, buildPreserveCapitalCandidate, buildPropertyImprovementCandidate } from "./allocation-builders";
import { evaluatedAt, highConfidence, portfolioId, position } from "../domain/allocation/test-fixtures";

const unknownHealth = { affectedDimensions: [], expectedDirection: "unknown" as const, addressesLimitingDimension: false, addressesCriticalFinding: false, evidence: [] };
describe("capital allocation candidate builders", () => {
  it.each(["purchase", "rental-arbitrage"] as const)("maps a %s acquisition without recalculating underwriting", (route) => {
    const result = buildAcquisitionCandidate({ portfolioId, goals: [], source: {
      opportunityId: `opportunity-${route}`, opportunityVersion: 2, analysisId: "analysis-1", analysisVersion: 4,
      recommendation: "buy-with-conditions", requiredCapital: Money.usd(80_000), projectedAnnualCashFlow: Money.usd(16_000),
      acquisitionStatus: "approved", acquisitionRoute: route, pipelineStage: "offer-preparation", committed: false,
      confidence: highConfidence, updatedAt: evaluatedAt,
    } });
    expect(result.candidate).toMatchObject({ purpose: "new-acquisition", classification: "growth", subject: { type: "acquisition" }, requiredCapital: { status: "known", amount: { amount: 80_000 } } });
    expect(result.candidate?.expectedImpact.financial?.projectedAnnualCashFlow?.amount).toBe(16_000);
    expect(result.candidate?.sourceVersion.source).toContain("buy-with-conditions");
  });

  it("excludes exited, rejected, and acquired opportunities and blocks an unknown requirement", () => {
    const base = { opportunityId: "opportunity-1", opportunityVersion: 1, analysisId: "analysis-1", analysisVersion: 1, recommendation: "wait", requiredCapital: null, acquisitionRoute: "purchase" as const, committed: false, confidence: highConfidence, updatedAt: evaluatedAt };
    for (const acquisitionStatus of ["exited", "rejected", "acquired"] as const) expect(buildAcquisitionCandidate({ portfolioId, goals: [], source: { ...base, acquisitionStatus } }).excludedReason).toBe("terminal-opportunity");
    const unknown = buildAcquisitionCandidate({ portfolioId, goals: [], source: { ...base, acquisitionStatus: "candidate" } });
    expect(unknown.candidate?.requiredCapital.status).toBe("unknown");
    expect(unknown.dataGaps[0]).toMatchObject({ impact: "blocking", code: "ALLOCATION_REQUIREMENT_UNKNOWN" });
  });

  it("classifies risk remediation as protective and preserves canonical property identity", () => {
    const result = buildPropertyImprovementCandidate({ portfolioId, goals: [], source: {
      propertyId: "property-1", improvementId: "repair-roof", category: "risk", requiredCapital: Money.usd(25_000),
      expectedHealthImpact: { ...unknownHealth, expectedDirection: "improve", addressesCriticalFinding: true },
      urgency: { urgency: "immediate", delayImpact: "critical" }, confidence: highConfidence, updatedAt: evaluatedAt,
    } });
    expect(result.candidate).toMatchObject({ purpose: "risk-remediation", classification: "protective", subject: { propertyId: "property-1" } });
  });

  it("builds committed obligations and retains unknown mandatory amounts as blocking", () => {
    const known = buildObligationCandidate(portfolioId, { obligationId: "closing-1", subject: { type: "obligation", obligationId: "closing-1" }, type: "acquisition-closing", amount: Money.usd(50_000), committed: true, severity: "critical", confidence: highConfidence });
    expect(known.candidate).toMatchObject({ classification: "mandatory", purpose: "acquisition-closing", requiredCapital: { committed: true } });
    const unknown = buildObligationCandidate(portfolioId, { obligationId: "regulatory-1", subject: { type: "obligation", obligationId: "regulatory-1" }, type: "regulatory", amount: null, committed: true, severity: "high", confidence: highConfidence });
    expect(unknown.dataGaps[0].impact).toBe("blocking");
  });

  it("always builds a hold candidate with zero deployment and no fabricated return", () => {
    const candidate = buildPreserveCapitalCandidate({ portfolioId, capital: position(), confidence: highConfidence });
    expect(candidate).toMatchObject({ purpose: "defer-deployment", classification: "hold", requiredCapital: { status: "known", amount: { amount: 0 } } });
    expect(candidate.expectedImpact.financial).toBeNull();
  });
});
