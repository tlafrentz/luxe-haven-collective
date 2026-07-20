import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createEvidenceId,
} from "../../evidence";

import {
  ObservationSubject,
} from "../../observations";

import {
  Claim,
} from "./claim";

import {
  ClaimEvidenceReference,
} from "./claim-evidence-reference";

import {
  ClaimEvidenceRole,
} from "./claim-evidence-role";

import {
  createClaimId,
} from "./claim-id";

import {
  ClaimSource,
} from "./claim-source";

import {
  ClaimStatus,
} from "./claim-status";

const createdAt = new Date(
  "2026-07-19T18:00:00.000Z",
);

function createInput() {
  return {
    type:
      "investment.return.below-target",
    subject: {
      type: "property",
      id:
        "mesa-downtown-retreat",
    },
    statement:
      "Projected return does not meet acquisition criteria.",
    source: {
      capability:
        "investment-intelligence",
      name:
        "acquisition-claim-policy",
      version: "1",
    },
    createdAt,
  } as const;
}

describe("Claim", () => {
  it(
    "creates a proposed canonical claim",
    () => {
      const claim =
        Claim.create(
          createInput(),
        );

      expect(claim.type).toBe(
        "investment.return.below-target",
      );
      expect(
        claim.subject.type,
      ).toBe("property");
      expect(
        claim.subject.id,
      ).toBe(
        "mesa-downtown-retreat",
      );
      expect(
        claim.statement,
      ).toBe(
        "Projected return does not meet acquisition criteria.",
      );
      expect(claim.status).toBe(
        ClaimStatus.PROPOSED,
      );
      expect(
        claim.isProposed(),
      ).toBe(true);
      expect(
        claim.hasEvidence(),
      ).toBe(false);
    },
  );

  it(
    "accepts canonical subject and source values",
    () => {
      const subject =
        ObservationSubject.create({
          type: "property",
          id:
            "mesa-downtown-retreat",
        });

      const source =
        ClaimSource.create({
          capability:
            "investment-intelligence",
          name:
            "acquisition-claim-policy",
        });

      const claim =
        Claim.create({
          ...createInput(),
          subject,
          source,
        });

      expect(
        claim.subject,
      ).toBe(subject);
      expect(
        claim.source,
      ).toBe(source);
    },
  );

  it(
    "stores typed evidence references",
    () => {
      const primary =
        ClaimEvidenceReference.create({
          evidenceId:
            "evidence-return",
          role:
            ClaimEvidenceRole.PRIMARY,
          note:
            "Primary return evidence.",
        });

      const supportingId =
        createEvidenceId(
          "evidence-cap-rate",
        );

      const claim =
        Claim.create({
          ...createInput(),
          evidenceReferences: [
            primary,
            {
              evidenceId:
                supportingId,
              role:
                ClaimEvidenceRole.SUPPORTING,
            },
          ],
        });

      expect(
        claim.hasEvidence(),
      ).toBe(true);
      expect(
        claim.evidenceReferences,
      ).toHaveLength(2);
      expect(
        claim.evidenceReferences[0],
      ).toBe(primary);
      expect(
        claim.referencesEvidence(
          supportingId,
        ),
      ).toBe(true);
      expect(
        claim.evidenceReferenceFor(
          supportingId,
        )?.role,
      ).toBe(
        ClaimEvidenceRole.SUPPORTING,
      );
    },
  );

  it(
    "converts evidenceIds to primary references",
    () => {
      const evidenceId =
        createEvidenceId(
          "evidence-return",
        );

      const claim =
        Claim.create({
          ...createInput(),
          evidenceIds: [
            evidenceId,
          ],
        });

      expect(
        claim.evidenceIds.map(
          (id) => id.value,
        ),
      ).toEqual([
        "evidence-return",
      ]);

      expect(
        claim.evidenceReferences[0]
          .role,
      ).toBe(
        ClaimEvidenceRole.PRIMARY,
      );
    },
  );

  it(
    "deduplicates evidence references by evidence id",
    () => {
      const evidenceId =
        createEvidenceId(
          "evidence-return",
        );

      const claim =
        Claim.create({
          ...createInput(),
          evidenceReferences: [
            {
              evidenceId,
              role:
                ClaimEvidenceRole.SUPPORTING,
            },
          ],
          evidenceIds: [
            evidenceId,
          ],
        });

      expect(
        claim.evidenceReferences,
      ).toHaveLength(1);
      expect(
        claim.evidenceReferences[0]
          .role,
      ).toBe(
        ClaimEvidenceRole.SUPPORTING,
      );
    },
  );

  it(
    "returns defensive evidence arrays",
    () => {
      const claim =
        Claim.create({
          ...createInput(),
          evidenceIds: [
            createEvidenceId(
              "evidence-return",
            ),
          ],
        });

      const references = [
        ...claim.evidenceReferences,
      ];

      references.length = 0;

      expect(
        claim.evidenceReferences,
      ).toHaveLength(1);
    },
  );

  it(
    "accepts active status",
    () => {
      const claim =
        Claim.create({
          ...createInput(),
          status:
            ClaimStatus.ACTIVE,
        });

      expect(
        claim.isActive(),
      ).toBe(true);
      expect(
        claim.isProposed(),
      ).toBe(false);
    },
  );

  it(
    "preserves explicit identity",
    () => {
      const id =
        createClaimId(
          "claim-001",
        );

      const first =
        Claim.create({
          ...createInput(),
          id,
        });

      const second =
        Claim.create({
          ...createInput(),
          id,
          statement:
            "A different proposition.",
        });

      expect(
        first.equals(second),
      ).toBe(true);
    },
  );

  it(
    "checks subject identity",
    () => {
      const claim =
        Claim.create(
          createInput(),
        );

      expect(
        claim.concerns(
          "property",
          "mesa-downtown-retreat",
        ),
      ).toBe(true);

      expect(
        claim.concerns(
          "market",
          "mesa",
        ),
      ).toBe(false);
    },
  );

  it(
    "copies supplied dates",
    () => {
      const sourceCreatedAt =
        new Date(
          "2026-07-19T18:00:00.000Z",
        );

      const sourceUpdatedAt =
        new Date(
          "2026-07-19T19:00:00.000Z",
        );

      const claim =
        Claim.create({
          ...createInput(),
          createdAt:
            sourceCreatedAt,
          updatedAt:
            sourceUpdatedAt,
        });

      sourceCreatedAt.setUTCFullYear(
        2030,
      );
      sourceUpdatedAt.setUTCFullYear(
        2030,
      );

      expect(
        claim.createdAt.toISOString(),
      ).toBe(
        "2026-07-19T18:00:00.000Z",
      );
      expect(
        claim.updatedAt.toISOString(),
      ).toBe(
        "2026-07-19T19:00:00.000Z",
      );
    },
  );

  it(
    "rejects missing required text",
    () => {
      expect(() =>
        Claim.create({
          ...createInput(),
          type: " ",
        }),
      ).toThrow(
        "Claim type cannot be empty.",
      );

      expect(() =>
        Claim.create({
          ...createInput(),
          statement: " ",
        }),
      ).toThrow(
        "Claim statement cannot be empty.",
      );
    },
  );

  it(
    "rejects invalid dates",
    () => {
      expect(() =>
        Claim.create({
          ...createInput(),
          createdAt:
            new Date("invalid"),
        }),
      ).toThrow(
        "Claim createdAt must be valid.",
      );

      expect(() =>
        Claim.create({
          ...createInput(),
          updatedAt:
            new Date("invalid"),
        }),
      ).toThrow(
        "Claim updatedAt must be valid.",
      );
    },
  );

  it(
    "rejects updatedAt before createdAt",
    () => {
      expect(() =>
        Claim.create({
          ...createInput(),
          updatedAt:
            new Date(
              "2026-07-19T17:59:59.999Z",
            ),
        }),
      ).toThrow(
        "Claim updatedAt cannot precede createdAt.",
      );
    },
  );
});
