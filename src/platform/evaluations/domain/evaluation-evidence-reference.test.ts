import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createEvidenceId,
} from "../../evidence";

import {
  EvaluationEvidenceReference,
} from "./evaluation-evidence-reference";

import {
  EvaluationEvidenceRole,
} from "./evaluation-evidence-role";

import {
  EvaluationEvidenceWeight,
} from "./evaluation-evidence-weight";

describe(
  "EvaluationEvidenceReference",
  () => {
    it(
      "defaults to supporting with full influence",
      () => {
        const reference =
          EvaluationEvidenceReference.create({
            evidenceId:
              "evidence-return",
          });

        expect(reference.role).toBe(
          EvaluationEvidenceRole.SUPPORTING,
        );
        expect(
          reference.weight.value,
        ).toBe(1);
        expect(
          reference.influencedEvaluation(),
        ).toBe(true);
      },
    );

    it(
      "accepts explicit role, weight, and note",
      () => {
        const reference =
          EvaluationEvidenceReference.create({
            evidenceId:
              createEvidenceId(
                "evidence-market-demand",
              ),
            role:
              EvaluationEvidenceRole.CONTRADICTING,
            weight:
              EvaluationEvidenceWeight.create(
                0.27,
              ),
            note:
              "Demand evidence contradicts the revenue assumption.",
          });

        expect(
          reference.isContradicting(),
        ).toBe(true);
        expect(
          reference.weight.value,
        ).toBe(0.27);
        expect(reference.note).toBe(
          "Demand evidence contradicts the revenue assumption.",
        );
      },
    );

    it(
      "treats discarded and zero-weight references as non-influential",
      () => {
        const discarded =
          EvaluationEvidenceReference.create({
            evidenceId:
              "evidence-low-quality",
            role:
              EvaluationEvidenceRole.DISCARDED,
            weight: 0.8,
          });

        const zero =
          EvaluationEvidenceReference.create({
            evidenceId:
              "evidence-context",
            role:
              EvaluationEvidenceRole.CONSIDERED,
            weight: 0,
          });

        expect(
          discarded.influencedEvaluation(),
        ).toBe(false);
        expect(
          zero.influencedEvaluation(),
        ).toBe(false);
      },
    );

    it(
      "supports Evidence identity matching",
      () => {
        const evidenceId =
          createEvidenceId(
            "evidence-return",
          );

        const reference =
          EvaluationEvidenceReference.create({
            evidenceId,
          });

        expect(
          reference.references(
            evidenceId,
          ),
        ).toBe(true);
      },
    );

    it(
      "rejects blank notes",
      () => {
        expect(() =>
          EvaluationEvidenceReference.create({
            evidenceId:
              "evidence-return",
            note: " ",
          }),
        ).toThrow(
          "Evaluation evidence reference note cannot be empty.",
        );
      },
    );
  },
);
