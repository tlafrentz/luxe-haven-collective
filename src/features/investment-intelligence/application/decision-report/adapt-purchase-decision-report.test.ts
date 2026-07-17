import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PurchaseDecisionReport,
} from "../../domain";

import {
  adaptPurchaseDecisionReport,
} from "./adapt-purchase-decision-report";

const report: PurchaseDecisionReport = {
  thesis: {
    headline: "Supportable acquisition",
    summary:
      "The base case is profitable and maintains acceptable downside protection.",
    strengths: [
      "Positive annual cash flow.",
    ],
    weaknesses: [
      "Downside performance requires validation.",
    ],
  },
  evidence: [
    {
      category: "financial",
      label: "Annual cash flow",
      finding:
        "The base underwriting produces positive annual cash flow.",
      value: "$12,000",
      positive: true,
    },
    {
      category: "resilience",
      label: "Downside cash flow",
      finding:
        "The downside case reaches break-even.",
      value: "$0",
      positive: false,
    },
  ],
  risks: [
    {
      code: "thin-dscr",
      title:
        "Thin debt-service coverage",
      severity: "medium",
      finding: "Modeled DSCR is 1.20.",
      impact:
        "Revenue compression could impair debt coverage.",
      mitigation:
        "Improve financing terms.",
    },
  ],
  opportunities: [
    {
      code: "revenue-upside",
      title:
        "Capture modeled revenue upside",
      finding:
        "The upside case improves annual cash flow.",
      expectedUpside:
        "Higher ADR increases cash-on-cash return.",
      nextAction:
        "Validate premium positioning.",
    },
  ],
  confidence: {
    score: 72,
    level: "high",
    explanation:
      "The decision is supported by adequate underwriting evidence.",
    factors: [
      {
        label: "Revenue projection",
        score: 80,
        weight: 30,
        explanation:
          "Revenue assumptions have strong support.",
      },
    ],
  },
  recommendation: {
    recommendation:
      "buy-with-conditions",
    headline:
      "Proceed after resolving conditions",
    rationale:
      "Base economics are positive but downside protection is limited.",
    conditions: [
      "Validate the downside case.",
    ],
    nextActions: [
      "Confirm property-specific expenses.",
    ],
  },
  scenarios: [],
  failurePoints: {} as PurchaseDecisionReport["failurePoints"],
};

describe("adaptPurchaseDecisionReport", () => {
  it("maps purchase reasoning into the shared decision-report contract", () => {
    const result =
      adaptPurchaseDecisionReport(report);

    expect(result.strategy).toBe(
      "purchase",
    );

    expect(
      result.recommendation.value,
    ).toBe("buy-with-conditions");

    expect(result.evidence).toEqual([
      expect.objectContaining({
        id: "financial-1",
        direction: "positive",
      }),
      expect.objectContaining({
        id: "resilience-2",
        direction: "caution",
      }),
    ]);

    expect(result.risks[0]?.id).toBe(
      "thin-dscr",
    );

    expect(
      result.opportunities[0]?.id,
    ).toBe("revenue-upside");
  });

  it("does not mutate the strategy-specific report", () => {
    const originalHeadline =
      report.recommendation.headline;

    adaptPurchaseDecisionReport(report);

    expect(
      report.recommendation.headline,
    ).toBe(originalHeadline);
  });
});
