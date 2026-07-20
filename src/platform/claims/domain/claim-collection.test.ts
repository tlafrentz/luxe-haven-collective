import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createEvidenceId,
} from "../../evidence";

import {
  Claim,
} from "./claim";

import {
  ClaimCollection,
} from "./claim-collection";

import {
  ClaimEvidenceRole,
} from "./claim-evidence-role";

import {
  createClaimId,
} from "./claim-id";

import {
  ClaimStatus,
} from "./claim-status";

function createClaim(
  input: Readonly<{
    id: string;
    type?: string;
    subjectType?: string;
    subjectId?: string;
    status?: ClaimStatus;
    capability?: string;
    sourceName?: string;
    createdAt?: string;
    updatedAt?: string;
    evidenceId?: string;
  }>,
): Claim {
  return Claim.create({
    id:
      createClaimId(input.id),
    type:
      input.type ??
      "investment.return.below-target",
    subject: {
      type:
        input.subjectType ??
        "property",
      id:
        input.subjectId ??
        "mesa-downtown-retreat",
    },
    statement:
      `Claim ${input.id}.`,
    status:
      input.status ??
      ClaimStatus.PROPOSED,
    source: {
      capability:
        input.capability ??
        "investment-intelligence",
      name:
        input.sourceName ??
        "acquisition-claim-policy",
    },
    evidenceReferences:
      input.evidenceId
        ? [
            {
              evidenceId:
                createEvidenceId(
                  input.evidenceId,
                ),
              role:
                ClaimEvidenceRole.PRIMARY,
            },
          ]
        : [],
    createdAt:
      new Date(
        input.createdAt ??
          "2026-07-19T18:00:00.000Z",
      ),
    updatedAt:
      new Date(
        input.updatedAt ??
          input.createdAt ??
          "2026-07-19T18:00:00.000Z",
      ),
  });
}

const claims = [
  createClaim({
    id: "claim-001",
    type:
      "investment.return.below-target",
    status:
      ClaimStatus.PROPOSED,
    createdAt:
      "2026-07-19T18:00:00.000Z",
    evidenceId:
      "evidence-return",
  }),
  createClaim({
    id: "claim-002",
    type:
      "investment.financing.unsustainable",
    status:
      ClaimStatus.ACTIVE,
    createdAt:
      "2026-07-19T19:00:00.000Z",
    evidenceId:
      "evidence-dscr",
  }),
  createClaim({
    id: "claim-003",
    type:
      "revenue.weekday-demand-underperforming",
    subjectType: "property",
    subjectId:
      "scottsdale-retreat",
    status:
      ClaimStatus.ACTIVE,
    capability:
      "revenue-intelligence",
    sourceName:
      "weekday-demand-policy",
    createdAt:
      "2026-07-19T20:00:00.000Z",
    evidenceId:
      "evidence-weekday-demand",
  }),
] as const;

describe(
  "ClaimCollection",
  () => {
    it(
      "creates empty and populated collections",
      () => {
        const empty =
          ClaimCollection.empty();

        expect(empty.size).toBe(0);
        expect(empty.isEmpty).toBe(
          true,
        );
        expect(
          empty.isNotEmpty,
        ).toBe(false);

        const collection =
          ClaimCollection.create(
            claims,
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
      "finds and requires claims by identity",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
          );

        expect(
          collection.has(
            claims[0].id,
          ),
        ).toBe(true);

        expect(
          collection.get(
            claims[1].id,
          ),
        ).toBe(claims[1]);

        expect(
          collection.require(
            claims[2].id,
          ),
        ).toBe(claims[2]);

        expect(() =>
          collection.require(
            createClaimId(
              "claim-missing",
            ),
          ),
        ).toThrow(
          "Claim not found: claim-missing.",
        );
      },
    );

    it(
      "adds and removes claims immutably",
      () => {
        const original =
          ClaimCollection.create([
            claims[0],
          ]);

        const added =
          original.add(
            claims[1],
          );

        const removed =
          added.remove(
            claims[0].id,
          );

        expect(original.size).toBe(
          1,
        );
        expect(added.size).toBe(2);
        expect(removed.size).toBe(
          1,
        );
        expect(
          removed.has(
            claims[1].id,
          ),
        ).toBe(true);
      },
    );

    it(
      "adds many claims",
      () => {
        const collection =
          ClaimCollection.empty()
            .addMany(claims);

        expect(
          collection.size,
        ).toBe(3);
      },
    );

    it(
      "rejects duplicate claim identities",
      () => {
        expect(() =>
          ClaimCollection.create([
            claims[0],
            claims[0],
          ]),
        ).toThrow(
          "Claim IDs must be unique.",
        );

        expect(() =>
          ClaimCollection.create([
            claims[0],
          ]).add(
            claims[0],
          ),
        ).toThrow(
          "Claim already exists: claim-001.",
        );

        expect(() =>
          ClaimCollection.create([
            claims[0],
          ]).addMany([
            claims[0],
          ]),
        ).toThrow(
          "Claim IDs must be unique.",
        );
      },
    );

    it(
      "filters by predicate, type, and status",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
          );

        expect(
          collection
            .filter(
              (claim) =>
                claim.type.startsWith(
                  "investment.",
                ),
            )
            .size,
        ).toBe(2);

        expect(
          collection
            .ofType(
              "investment.financing.unsustainable",
            )
            .toArray(),
        ).toEqual([
          claims[1],
        ]);

        expect(
          collection
            .proposed()
            .toArray(),
        ).toEqual([
          claims[0],
        ]);

        expect(
          collection
            .active()
            .size,
        ).toBe(2);
      },
    );

    it(
      "filters by subject",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
          );

        expect(
          collection
            .concerning(
              "property",
              "mesa-downtown-retreat",
            )
            .size,
        ).toBe(2);

        expect(
          collection
            .concerning(
              "property",
              "scottsdale-retreat",
            )
            .toArray(),
        ).toEqual([
          claims[2],
        ]);
      },
    );

    it(
      "filters by source and capability",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
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
              "weekday-demand-policy",
            )
            .toArray(),
        ).toEqual([
          claims[2],
        ]);
      },
    );

    it(
      "finds claims referencing evidence",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
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
          claims[1],
        ]);
      },
    );

    it(
      "filters by created and updated chronology",
      () => {
        const updatedClaim =
          createClaim({
            id: "claim-004",
            createdAt:
              "2026-07-19T17:00:00.000Z",
            updatedAt:
              "2026-07-19T21:00:00.000Z",
          });

        const collection =
          ClaimCollection.create([
            ...claims,
            updatedClaim,
          ]);

        expect(
          collection
            .createdBetween(
              new Date(
                "2026-07-19T18:30:00.000Z",
              ),
              new Date(
                "2026-07-19T20:00:00.000Z",
              ),
            )
            .toArray(),
        ).toEqual([
          claims[1],
          claims[2],
        ]);

        expect(
          collection
            .updatedBetween(
              new Date(
                "2026-07-19T20:30:00.000Z",
              ),
              new Date(
                "2026-07-19T21:30:00.000Z",
              ),
            )
            .toArray(),
        ).toEqual([
          updatedClaim,
        ]);
      },
    );

    it(
      "rejects invalid chronology ranges",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
          );

        expect(() =>
          collection.createdBetween(
            new Date("invalid"),
            new Date(),
          ),
        ).toThrow(
          "Claim collection start date must be valid.",
        );

        expect(() =>
          collection.updatedBetween(
            new Date(
              "2026-07-20T00:00:00.000Z",
            ),
            new Date(
              "2026-07-19T00:00:00.000Z",
            ),
          ),
        ).toThrow(
          "Claim collection end date cannot precede start date.",
        );
      },
    );

    it(
      "orders claims deterministically",
      () => {
        const collection =
          ClaimCollection.create([
            claims[2],
            claims[0],
            claims[1],
          ]);

        expect(
          collection
            .oldestFirst()
            .toArray()
            .map(
              (claim) =>
                claim.id.value,
            ),
        ).toEqual([
          "claim-001",
          "claim-002",
          "claim-003",
        ]);

        expect(
          collection
            .newestFirst()
            .toArray()
            .map(
              (claim) =>
                claim.id.value,
            ),
        ).toEqual([
          "claim-003",
          "claim-002",
          "claim-001",
        ]);

        expect(
          collection.latest()?.id
            .value,
        ).toBe("claim-003");
      },
    );

    it(
      "groups claims by canonical dimensions",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
          );

        expect(
          collection
            .groupByType()
            .get(
              "investment.return.below-target",
            )
            ?.size,
        ).toBe(1);

        expect(
          collection
            .groupBySubject()
            .get(
              "property:mesa-downtown-retreat",
            )
            ?.size,
        ).toBe(2);

        expect(
          collection
            .groupByStatus()
            .get(
              ClaimStatus.ACTIVE,
            )
            ?.size,
        ).toBe(2);

        expect(
          collection
            .groupByCapability()
            .get(
              "investment-intelligence",
            )
            ?.size,
        ).toBe(2);
      },
    );

    it(
      "returns defensive arrays",
      () => {
        const collection =
          ClaimCollection.create(
            claims,
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
