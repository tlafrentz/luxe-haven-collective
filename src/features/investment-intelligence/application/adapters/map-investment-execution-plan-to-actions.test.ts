import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
} from "../../domain";
import {
  mapInvestmentExecutionPlanToActions,
} from "./map-investment-execution-plan-to-actions";

import type {
  InvestmentExecutionIntent,
} from "../types";

const intents: readonly InvestmentExecutionIntent[] = [
  {
    key: "verify-regulations",
    title: "Verify regulations",
    description:
      "Confirm the operating rules.",
    category: "regulatory-diligence",
    priority: "high",
    sequence: 1,
    required: true,
    dependencies: [],
    rationale:
      "Regulatory evidence is missing.",
    sourceReferences: [
      "data-gap:missing-regulation-source",
    ],
  },
];

const lineage = {
  acquisitionType:
    AcquisitionType.Purchase,
  subjectId: "property-1",
  decisionId: "decision-1",
  recommendationId: "recommendation-1",
  investmentRunId: "investment-run-1",
} as const;

const context = {
  planId: "plan-1",
  workspaceId: "workspace-1",
  plannedAt:
    new Date("2026-02-02T12:00:00Z"),
  actionIds: {
    "verify-regulations":
      "action-verify-regulations",
  },
} as const;

describe("mapInvestmentExecutionPlanToActions", () => {
  it("creates deterministic draft Actions with canonical lineage", () => {
    const actor = {
      id: "operator-1",
      displayName: "Operator",
    };
    const first =
      mapInvestmentExecutionPlanToActions(
        intents,
        lineage,
        actor,
        context,
      );
    const second =
      mapInvestmentExecutionPlanToActions(
        intents,
        lineage,
        actor,
        context,
      );

    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0].status).toBe("draft");
    expect(first[0].id.value).toBe(
      "action-verify-regulations",
    );
    expect(first[0].history[0].id.value)
      .toBe(
        "action-verify-regulations-created",
      );
    expect(first[0].createdAt).toEqual(
      context.plannedAt,
    );
    expect(first[0].createdBy).toEqual({
      type: "user",
      id: "operator-1",
    });
    expect(
      first[0].sources.map(
        ({ type, sourceId }) => [
          type,
          sourceId,
        ],
      ),
    ).toEqual([
      ["decision", "decision-1"],
      [
        "recommendation",
        "recommendation-1",
      ],
      ["automation", "plan-1"],
      ["automation", "verify-regulations"],
      ["api", "investment-run-1"],
      ["manual", "property-1"],
    ]);
    expect(first[0].assignments).toEqual([]);
    expect(first[0].scheduleValue).toEqual({
      created: context.plannedAt,
    });
  });
});
