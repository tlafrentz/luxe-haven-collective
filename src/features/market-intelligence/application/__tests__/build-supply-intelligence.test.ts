import { describe, expect, it } from "vitest";

import { buildSupplyIntelligence } from "../builders/build-supply-intelligence";

describe("buildSupplyIntelligence", () => {
  it("builds supply intelligence and detects competitive risks", () => {
    const intelligence = buildSupplyIntelligence({
      activeListingCount: 2400,
      professionalOperatorSharePercent: 68,
      luxuryInventorySharePercent: 42,
      inventoryGrowthPercent: 14,
      confidenceScore: 86,
    });

    expect(intelligence.activeListingCount).toBe(2400);
    expect(intelligence.saturationScore.value).toBeGreaterThanOrEqual(70);
    expect(intelligence.risks).toContain(
      "Rapid inventory growth may pressure occupancy and pricing power.",
    );
    expect(intelligence.risks).toContain(
      "A high professional-operator share raises the execution standard for new entrants.",
    );
    expect(intelligence.executiveSummary).toContain(
      "2,400 active listings",
    );
  });

  it("preserves explicit conclusions and reports data gaps", () => {
    const intelligence = buildSupplyIntelligence({
      saturationScore: 35,
      supplyScore: 78,
      confidenceScore: 55,
      opportunities: ["Premium inventory remains underserved."],
      risks: ["Regulatory status remains uncertain."],
      missingInformation: ["Active listing count"],
    });

    expect(intelligence.opportunities).toEqual([
      "Premium inventory remains underserved.",
    ]);
    expect(intelligence.risks).toEqual([
      "Regulatory status remains uncertain.",
    ]);
    expect(intelligence.hasMaterialUnknowns).toBe(true);
  });
});
