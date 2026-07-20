import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createClaimId,
} from "../../claims";

import {
  createEvidenceId,
} from "../../evidence";

import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";

import {
  Evaluation,
} from "./evaluation";

import {
  EvaluationDisposition,
} from "./evaluation-disposition";

import {
  EvaluationEvidenceReference,
} from "./evaluation-evidence-reference";

import {
  EvaluationEvidenceRole,
} from "./evaluation-evidence-role";

const confidence =
  ConfidenceAssessment.create({
    score:
      ConfidenceScore.create(91),
    level:
      ConfidenceLevel.VERY_HIGH,
    rationale: [
      "Strong Evidence coverage.",
    ],
  });

function createInput() {
  return {
    type:
      "investment.acquisition-return",
    claimId:
      createClaimId(
        "claim-return-below-target",
      ),
    disposition:
      EvaluationDisposition.SUPPORTED,
    summary:
      "Evidence supports the below-target return Claim.",
    confidence,
    source: {
      capability:
        "investment-intelligence",
      name:
        "acquisition-evaluation-policy",
      version: "1",
    },
    evaluatedAt:
      new Date(
        "2026-07-19T20:00:00.000Z",
      ),
  } as const;
}

describe("Evaluation", () => {
  it(
    "creates an evaluation without evidence",
    () => {
      const evaluation =
        Evaluation.create(
          createInput(),
        );

      expect(
        evaluation.hasEvidence(),
      ).toBe(false);
      expect(
        evaluation.evidenceReferences,
      ).toEqual([]);
    },
  );

  it(
    "stores typed Evidence influence references",
    () => {
      const supporting =
        EvaluationEvidenceReference.create({
          evidenceId:
            "evidence-return",
          role:
            EvaluationEvidenceRole.SUPPORTING,
          weight: 0.41,
        });

      const contradictingId =
        createEvidenceId(
          "evidence-market-growth",
        );

      const evaluation =
        Evaluation.create({
          ...createInput(),
          evidenceReferences: [
            supporting,
            {
              evidenceId:
                contradictingId,
              role:
                EvaluationEvidenceRole.CONTRADICTING,
              weight: 0.09,
              note:
                "Growth partially offsets the return risk.",
            },
          ],
        });

      expect(
        evaluation.hasEvidence(),
      ).toBe(true);
      expect(
        evaluation.evidenceReferences,
      ).toHaveLength(2);
      expect(
        evaluation.evidenceReferences[0],
      ).toBe(supporting);
      expect(
        evaluation.referencesEvidence(
          contradictingId,
        ),
      ).toBe(true);
      expect(
        evaluation.evidenceReferenceFor(
          contradictingId,
        )?.role,
      ).toBe(
        EvaluationEvidenceRole.CONTRADICTING,
      );
    },
  );

  it(
    "normalizes compatibility Evidence IDs",
    () => {
      const evidenceId =
        createEvidenceId(
          "evidence-return",
        );

      const evaluation =
        Evaluation.create({
          ...createInput(),
          evidenceIds: [
            evidenceId,
          ],
        });

      expect(
        evaluation.evidenceIds.map(
          (id) => id.value,
        ),
      ).toEqual([
        "evidence-return",
      ]);
      expect(
        evaluation.evidenceReferences[0]
          .role,
      ).toBe(
        EvaluationEvidenceRole.SUPPORTING,
      );
      expect(
        evaluation.evidenceReferences[0]
          .weight.value,
      ).toBe(1);
    },
  );

  it(
    "gives explicit references precedence over duplicate compatibility IDs",
    () => {
      const evidenceId =
        createEvidenceId(
          "evidence-return",
        );

      const evaluation =
        Evaluation.create({
          ...createInput(),
          evidenceReferences: [
            {
              evidenceId,
              role:
                EvaluationEvidenceRole.CONSIDERED,
              weight: 0.25,
            },
          ],
          evidenceIds: [
            evidenceId,
          ],
        });

      expect(
        evaluation.evidenceReferences,
      ).toHaveLength(1);
      expect(
        evaluation.evidenceReferences[0]
          .role,
      ).toBe(
        EvaluationEvidenceRole.CONSIDERED,
      );
      expect(
        evaluation.evidenceReferences[0]
          .weight.value,
      ).toBe(0.25);
    },
  );

  it(
    "queries references by influence role",
    () => {
      const evaluation =
        Evaluation.create({
          ...createInput(),
          evidenceReferences: [
            {
              evidenceId:
                "evidence-return",
              role:
                EvaluationEvidenceRole.SUPPORTING,
              weight: 0.41,
            },
            {
              evidenceId:
                "evidence-occupancy",
              role:
                EvaluationEvidenceRole.SUPPORTING,
              weight: 0.35,
            },
            {
              evidenceId:
                "evidence-growth",
              role:
                EvaluationEvidenceRole.CONTRADICTING,
              weight: 0.09,
            },
            {
              evidenceId:
                "evidence-seasonality",
              role:
                EvaluationEvidenceRole.CONSIDERED,
              weight: 0.05,
            },
            {
              evidenceId:
                "evidence-outlier",
              role:
                EvaluationEvidenceRole.DISCARDED,
              weight: 0.7,
            },
          ],
        });

      expect(
        evaluation.supportingEvidence(),
      ).toHaveLength(2);
      expect(
        evaluation.contradictingEvidence(),
      ).toHaveLength(1);
      expect(
        evaluation.consideredEvidence(),
      ).toHaveLength(1);
      expect(
        evaluation.discardedEvidence(),
      ).toHaveLength(1);
      expect(
        evaluation.influentialEvidence(),
      ).toHaveLength(4);
      expect(
        evaluation.totalInfluenceWeight(),
      ).toBeCloseTo(0.9);
    },
  );

  it(
    "returns defensive Evidence arrays",
    () => {
      const evaluation =
        Evaluation.create({
          ...createInput(),
          evidenceIds: [
            createEvidenceId(
              "evidence-return",
            ),
          ],
        });

      const references = [
        ...evaluation.evidenceReferences,
      ];

      references.length = 0;

      expect(
        evaluation.evidenceReferences,
      ).toHaveLength(1);
    },
  );
});
