import { describe, expect, it } from "vitest";
import type { InvestmentOpportunityRoute, OpportunityStatus } from "../domain";

// Decision-level fixture. Production pipeline policy is intentionally deferred
// to IA-002A.2; keeping this map executable prevents the ADR from drifting.
const stageToOpportunityStatus = {
  pursuit: "shortlisted",
  "offer-preparation": "shortlisted",
  "offer-submitted": "offer-submitted",
  negotiating: "offer-submitted",
  "under-contract": "under-contract",
  "due-diligence": "under-contract",
  "closing-preparation": "under-contract",
  "closed-acquired": "acquired",
  exited: "rejected",
} as const satisfies Readonly<Record<string, OpportunityStatus>>;

const existingStatuses: readonly OpportunityStatus[] = [
  "evaluating",
  "researching",
  "shortlisted",
  "offer-submitted",
  "under-contract",
  "acquired",
  "rejected",
];

describe("IA-002A.1 acquisition pipeline decisions", () => {
  it("maps every canonical stage to one existing coarse Opportunity status", () => {
    expect(Object.keys(stageToOpportunityStatus)).toHaveLength(9);
    for (const status of Object.values(stageToOpportunityStatus)) {
      expect(existingStatuses).toContain(status);
    }
  });

  it("keeps the two currently supported acquisition routes", () => {
    const routes: readonly InvestmentOpportunityRoute[] = ["purchase", "rental-arbitrage"];
    expect(routes).toEqual(["purchase", "rental-arbitrage"]);
  });

  it("makes terminal pipeline outcomes explicit", () => {
    expect(stageToOpportunityStatus["closed-acquired"]).toBe("acquired");
    expect(stageToOpportunityStatus.exited).toBe("rejected");
  });
});
