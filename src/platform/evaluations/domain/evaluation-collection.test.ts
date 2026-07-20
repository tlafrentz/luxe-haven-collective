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
  EvaluationCollection,
} from "./evaluation-collection";

import {
  EvaluationDisposition,
} from "./evaluation-disposition";

import {
  EvaluationEvidenceRole,
} from "./evaluation-evidence-role";

import {
  createEvaluationId,
} from "./evaluation-id";

function createEvaluation(
  input: Readonly<{
    id: string;
    type?: string;
    claimId?: string;
    disposition?:
      EvaluationDisposition;
    confidenceScore?: number;
    confidenceLevel?:
      ConfidenceLevel;
    capability?: string;
    sourceName?: string;
    evaluatedAt?: string;
    evidenceId?: string;
    evidenceRole?:
      EvaluationEvidenceRole;
  }>,
): Evaluation {
  return Evaluation.create({
    id:
      createEvaluationId(
        input.id,
      ),
    type:
      input.type ??
      "investment.acquisition-return",
    claimId:
      createClaimId(
        input.claimId ??
          "claim-return",
      ),
    disposition:
      input.disposition ??
      EvaluationDisposition.SUPPORTED,
    summary:
      `Evaluation ${input.id}.`,
    confidence:
      ConfidenceAssessment.create({
        score:
          ConfidenceScore.create(
            input.confidenceScore ??
              80,
          ),
        level:
          input.confidenceLevel ??
          ConfidenceLevel.HIGH,
        rationale: [
          "Test confidence.",
        ],
      }),
    evidenceReferences:
      input.evidenceId
        ? [
            {
              evidenceId:
                createEvidenceId(
                  input.evidenceId,
                ),
              role:
                input.evidenceRole ??
                EvaluationEvidenceRole.SUPPORTING,
              weight: 0.5,
            },
          ]
        : [],
    source: {
      capability:
        input.capability ??
        "investment-intelligence",
      name:
        input.sourceName ??
        "acquisition-evaluation-policy",
    },
    evaluatedAt:
      new Date(
        input.evaluatedAt ??
          "2026-07-19T18:00:00.000Z",
      ),
  });
}

const evaluations = [
  createEvaluation({
    id: "evaluation-001",
    claimId: "claim-return",
    disposition:
      EvaluationDisposition.SUPPORTED,
    confidenceScore: 91,
    confidenceLevel:
      ConfidenceLevel.VERY_HIGH,
    evaluatedAt:
      "2026-07-19T18:00:00.000Z",
    evidenceId:
      "evidence-return",
    evidenceRole:
      EvaluationEvidenceRole.SUPPORTING,
  }),
  createEvaluation({
    id: "evaluation-002",
    type:
      "investment.financing-quality",
    claimId:
      "claim-financing",
    disposition:
      EvaluationDisposition.MIXED,
    confidenceScore: 74,
    confidenceLevel:
      ConfidenceLevel.HIGH,
    evaluatedAt:
      "2026-07-19T19:00:00.000Z",
    evidenceId:
      "evidence-dscr",
    evidenceRole:
      EvaluationEvidenceRole.CONTRADICTING,
  }),
  createEvaluation({
    id: "evaluation-003",
    type:
      "revenue.weekday-demand",
    claimId:
      "claim-weekday-demand",
    disposition:
      EvaluationDisposition.INSUFFICIENT,
    confidenceScore: 48,
    confidenceLevel:
      ConfidenceLevel.VERY_HIGH,
    capability:
      "revenue-intelligence",
    sourceName:
      "weekday-demand-evaluation-policy",
    evaluatedAt:
      "2026-07-19T20:00:00.000Z",
    evidenceId:
      "evidence-weekday-demand",
    evidenceRole:
      EvaluationEvidenceRole.CONSIDERED,
  }),
] as const;

describe(
  "EvaluationCollection",
  () => {
    it(
      "creates empty and populated collections",
      () => {
        const empty =
          EvaluationCollection.empty();

        expect(empty.size).toBe(0);
        expect(
          empty.isEmpty,
        ).toBe(true);
        expect(
          empty.isNotEmpty,
        ).toBe(false);

        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection.size,
        ).toBe(3);
        expect(
          collection.isNotEmpty,
        ).toBe(true);
      },
    );

    it(
      "finds and requires Evaluations by identity",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection.has(
            evaluations[0].id,
          ),
        ).toBe(true);

        expect(
          collection.get(
            evaluations[1].id,
          ),
        ).toBe(
          evaluations[1],
        );

        expect(
          collection.require(
            evaluations[2].id,
          ),
        ).toBe(
          evaluations[2],
        );

        expect(() =>
          collection.require(
            createEvaluationId(
              "evaluation-missing",
            ),
          ),
        ).toThrow(
          "Evaluation not found: evaluation-missing.",
        );
      },
    );

    it(
      "adds and removes Evaluations immutably",
      () => {
        const original =
          EvaluationCollection.create([
            evaluations[0],
          ]);

        const added =
          original.add(
            evaluations[1],
          );

        const removed =
          added.remove(
            evaluations[0].id,
          );

        expect(
          original.size,
        ).toBe(1);
        expect(
          added.size,
        ).toBe(2);
        expect(
          removed.size,
        ).toBe(1);
        expect(
          removed.has(
            evaluations[1].id,
          ),
        ).toBe(true);
      },
    );

    it(
      "adds many Evaluations",
      () => {
        const collection =
          EvaluationCollection
            .empty()
            .addMany(
              evaluations,
            );

        expect(
          collection.size,
        ).toBe(3);
      },
    );

    it(
      "rejects duplicate Evaluation identities",
      () => {
        expect(() =>
          EvaluationCollection.create([
            evaluations[0],
            evaluations[0],
          ]),
        ).toThrow(
          "Evaluation IDs must be unique.",
        );

        expect(() =>
          EvaluationCollection.create([
            evaluations[0],
          ]).add(
            evaluations[0],
          ),
        ).toThrow(
          "Evaluation already exists: evaluation-001.",
        );

        expect(() =>
          EvaluationCollection.create([
            evaluations[0],
          ]).addMany([
            evaluations[0],
          ]),
        ).toThrow(
          "Evaluation IDs must be unique.",
        );
      },
    );

    it(
      "filters by predicate, type, and disposition",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .filter(
              (evaluation) =>
                evaluation.type
                  .startsWith(
                    "investment.",
                  ),
            )
            .size,
        ).toBe(2);

        expect(
          collection
            .ofType(
              "investment.financing-quality",
            )
            .toArray(),
        ).toEqual([
          evaluations[1],
        ]);

        expect(
          collection
            .supported()
            .toArray(),
        ).toEqual([
          evaluations[0],
        ]);

        expect(
          collection
            .mixed()
            .toArray(),
        ).toEqual([
          evaluations[1],
        ]);

        expect(
          collection
            .insufficient()
            .toArray(),
        ).toEqual([
          evaluations[2],
        ]);

        expect(
          collection.opposed().size,
        ).toBe(0);
      },
    );

    it(
      "filters by evaluated Claim",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .evaluatingClaim(
              createClaimId(
                "claim-financing",
              ),
            )
            .toArray(),
        ).toEqual([
          evaluations[1],
        ]);
      },
    );

    it(
      "filters by source and capability",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .fromCapability(
              "investment-intelligence",
            )
            .size,
        ).toBe(2);

        expect(
          collection
            .fromSource(
              "revenue-intelligence",
              "weekday-demand-evaluation-policy",
            )
            .toArray(),
        ).toEqual([
          evaluations[2],
        ]);
      },
    );

    it(
      "filters by confidence",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .withConfidenceLevel(
              ConfidenceLevel.HIGH,
            )
            .toArray(),
        ).toEqual([
          evaluations[1],
        ]);

        expect(
          collection
            .withMinimumConfidence(
              75,
            )
            .toArray(),
        ).toEqual([
          evaluations[0],
        ]);
      },
    );

    it(
      "rejects invalid confidence thresholds",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(() =>
          collection
            .withMinimumConfidence(
              Number.NaN,
            ),
        ).toThrow(
          "Minimum confidence score must be finite.",
        );

        expect(() =>
          collection
            .withMinimumConfidence(
              101,
            ),
        ).toThrow(
          "Minimum confidence score must be between 0 and 100.",
        );
      },
    );

    it(
      "finds Evaluations through Evidence traceability",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .referencingEvidence(
              createEvidenceId(
                "evidence-dscr",
              ),
            )
            .toArray(),
        ).toEqual([
          evaluations[1],
        ]);

        expect(
          collection
            .withSupportingEvidence(
              createEvidenceId(
                "evidence-return",
              ),
            )
            .toArray(),
        ).toEqual([
          evaluations[0],
        ]);

        expect(
          collection
            .withContradictingEvidence(
              createEvidenceId(
                "evidence-dscr",
              ),
            )
            .toArray(),
        ).toEqual([
          evaluations[1],
        ]);
      },
    );

    it(
      "filters by inclusive evaluation chronology",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .evaluatedBetween(
              new Date(
                "2026-07-19T19:00:00.000Z",
              ),
              new Date(
                "2026-07-19T20:00:00.000Z",
              ),
            )
            .toArray(),
        ).toEqual([
          evaluations[1],
          evaluations[2],
        ]);
      },
    );

    it(
      "rejects invalid chronology ranges",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(() =>
          collection
            .evaluatedBetween(
              new Date("invalid"),
              new Date(),
            ),
        ).toThrow(
          "Evaluation collection start date must be valid.",
        );

        expect(() =>
          collection
            .evaluatedBetween(
              new Date(
                "2026-07-20T00:00:00.000Z",
              ),
              new Date(
                "2026-07-19T00:00:00.000Z",
              ),
            ),
        ).toThrow(
          "Evaluation collection end date cannot precede start date.",
        );
      },
    );

    it(
      "orders Evaluations deterministically by chronology",
      () => {
        const collection =
          EvaluationCollection.create([
            evaluations[2],
            evaluations[0],
            evaluations[1],
          ]);

        expect(
          collection
            .oldestFirst()
            .toArray()
            .map(
              (evaluation) =>
                evaluation.id.value,
            ),
        ).toEqual([
          "evaluation-001",
          "evaluation-002",
          "evaluation-003",
        ]);

        expect(
          collection
            .newestFirst()
            .toArray()
            .map(
              (evaluation) =>
                evaluation.id.value,
            ),
        ).toEqual([
          "evaluation-003",
          "evaluation-002",
          "evaluation-001",
        ]);

        expect(
          collection.latest()?.id
            .value,
        ).toBe(
          "evaluation-003",
        );
      },
    );

    it(
      "orders Evaluations by confidence",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .highestConfidenceFirst()
            .toArray()
            .map(
              (evaluation) =>
                evaluation.id.value,
            ),
        ).toEqual([
          "evaluation-001",
          "evaluation-002",
          "evaluation-003",
        ]);

        expect(
          collection
            .lowestConfidenceFirst()
            .toArray()
            .map(
              (evaluation) =>
                evaluation.id.value,
            ),
        ).toEqual([
          "evaluation-003",
          "evaluation-002",
          "evaluation-001",
        ]);

        expect(
          collection
            .highestConfidence()
            ?.id.value,
        ).toBe(
          "evaluation-001",
        );
      },
    );

    it(
      "groups Evaluations by canonical dimensions",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        expect(
          collection
            .groupByType()
            .get(
              "investment.acquisition-return",
            )
            ?.size,
        ).toBe(1);

        expect(
          collection
            .groupByDisposition()
            .get(
              EvaluationDisposition.SUPPORTED,
            )
            ?.size,
        ).toBe(1);

        expect(
          collection
            .groupByClaim()
            .get(
              "claim-financing",
            )
            ?.size,
        ).toBe(1);

        expect(
          collection
            .groupByCapability()
            .get(
              "investment-intelligence",
            )
            ?.size,
        ).toBe(2);

        expect(
          collection
            .groupByConfidenceLevel()
            .get(
              ConfidenceLevel.HIGH,
            )
            ?.size,
        ).toBe(1);

        expect(
          collection
            .groupByConfidenceLevel()
            .get(
              ConfidenceLevel.VERY_HIGH,
            )
            ?.size,
        ).toBe(2);
      },
    );

    it(
      "returns defensive arrays",
      () => {
        const collection =
          EvaluationCollection.create(
            evaluations,
          );

        const array = [
          ...collection.toArray(),
        ];

        array.length = 0;

        expect(
          collection.size,
        ).toBe(3);
      },
    );
  },
);
