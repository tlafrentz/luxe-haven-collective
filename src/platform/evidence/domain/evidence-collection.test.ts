import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createObservationId,
} from "../../observations";

import {
  Evidence,
} from "./evidence";

import {
  EvidenceCollection,
  createEvidenceSubjectKey,
} from "./evidence-collection";

import {
  EvidenceDirection,
} from "./evidence-direction";

import {
  createEvidenceId,
} from "./evidence-id";

import {
  EvidenceStrength,
} from "./evidence-strength";

function createEvidence(
  overrides: Partial<
    Parameters<
      typeof Evidence.create
    >[0]
  > = {},
): Evidence {
  return Evidence.create({
    id:
      overrides.id ??
      createEvidenceId(
        "evidence-default",
      ),
    type:
      overrides.type ??
      "investment.financial.cap-rate",
    subject:
      overrides.subject ?? {
        type: "property",
        id: "property-001",
      },
    title:
      overrides.title ??
      "Cap rate interpretation",
    explanation:
      overrides.explanation ??
      "The cap rate affects acquisition quality.",
    direction:
      overrides.direction ??
      EvidenceDirection.SUPPORTING,
    strength:
      overrides.strength ??
      EvidenceStrength.STRONG,
    source:
      overrides.source ?? {
        capability:
          "investment-intelligence",
        name:
          "investment-evidence-policy",
      },
    observationIds:
      overrides.observationIds ?? [
        createObservationId(
          "observation-cap-rate",
        ),
      ],
    references:
      overrides.references,
    createdAt:
      overrides.createdAt ??
      new Date(
        "2026-07-19T18:00:00.000Z",
      ),
    metadata:
      overrides.metadata,
  });
}

describe("EvidenceCollection", () => {
  it(
    "creates empty and populated collections",
    () => {
      const empty =
        EvidenceCollection.empty();

      const evidence =
        createEvidence();

      const populated =
        EvidenceCollection.create([
          evidence,
        ]);

      expect(empty.isEmpty).toBe(true);
      expect(empty.isNotEmpty).toBe(
        false,
      );
      expect(populated.size).toBe(1);
      expect(
        [...populated],
      ).toEqual([evidence]);
    },
  );

  it(
    "rejects duplicate evidence ids",
    () => {
      const first =
        createEvidence();

      const duplicate =
        createEvidence();

      expect(() =>
        EvidenceCollection.create([
          first,
          duplicate,
        ]),
      ).toThrow(
        "Evidence collection cannot contain duplicate evidence ids.",
      );
    },
  );

  it(
    "supports identity operations immutably",
    () => {
      const first =
        createEvidence();

      const second =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-second",
            ),
        });

      const original =
        EvidenceCollection.create([
          first,
        ]);

      const added =
        original.add(second);

      expect(original.size).toBe(1);
      expect(added.size).toBe(2);
      expect(
        added.has(second.id),
      ).toBe(true);
      expect(
        added.get(second.id),
      ).toBe(second);
      expect(
        added.require(second.id),
      ).toBe(second);
      expect(
        added.remove(first.id)
          .toArray(),
      ).toEqual([second]);
    },
  );

  it(
    "filters by domain semantics",
    () => {
      const supporting =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-supporting",
            ),
          direction:
            EvidenceDirection.SUPPORTING,
        });

      const opposing =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-opposing",
            ),
          direction:
            EvidenceDirection.OPPOSING,
          strength:
            EvidenceStrength.DECISIVE,
        });

      const collection =
        EvidenceCollection.create([
          supporting,
          opposing,
        ]);

      expect(
        collection.supporting()
          .toArray(),
      ).toEqual([supporting]);
      expect(
        collection.opposing()
          .toArray(),
      ).toEqual([opposing]);
      expect(
        collection.ofStrength(
          EvidenceStrength.DECISIVE,
        ).toArray(),
      ).toEqual([opposing]);
    },
  );

  it(
    "queries subjects, sources, and observation references",
    () => {
      const referencedId =
        createObservationId(
          "observation-cap-rate",
        );

      const evidence =
        createEvidence({
          observationIds: [
            referencedId,
          ],
        });

      const collection =
        EvidenceCollection.create([
          evidence,
        ]);

      expect(
        collection.concerning(
          "property",
          "property-001",
        ).size,
      ).toBe(1);
      expect(
        collection.fromCapability(
          "investment-intelligence",
        ).size,
      ).toBe(1);
      expect(
        collection.fromSource(
          "investment-intelligence",
          "investment-evidence-policy",
        ).size,
      ).toBe(1);
      expect(
        collection.forObservation(
          referencedId,
        ).size,
      ).toBe(1);
    },
  );

  it(
    "filters inclusively by creation range",
    () => {
      const first =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-first",
            ),
          createdAt:
            new Date(
              "2026-07-18T18:00:00.000Z",
            ),
        });

      const second =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-second",
            ),
          createdAt:
            new Date(
              "2026-07-19T18:00:00.000Z",
            ),
        });

      const collection =
        EvidenceCollection.create([
          first,
          second,
        ]);

      expect(
        collection.createdBetween(
          new Date(
            "2026-07-19T18:00:00.000Z",
          ),
          new Date(
            "2026-07-19T18:00:00.000Z",
          ),
        ).toArray(),
      ).toEqual([second]);
    },
  );

  it(
    "orders deterministically by date and id",
    () => {
      const laterB =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-b",
            ),
          createdAt:
            new Date(
              "2026-07-19T18:00:00.000Z",
            ),
        });

      const earlier =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-earlier",
            ),
          createdAt:
            new Date(
              "2026-07-18T18:00:00.000Z",
            ),
        });

      const laterA =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-a",
            ),
          createdAt:
            new Date(
              "2026-07-19T18:00:00.000Z",
            ),
        });

      const collection =
        EvidenceCollection.create([
          laterB,
          earlier,
          laterA,
        ]);

      expect(
        collection.oldestFirst()
          .toArray()
          .map(
            (evidence) =>
              evidence.id.value,
          ),
      ).toEqual([
        "evidence-earlier",
        "evidence-a",
        "evidence-b",
      ]);

      expect(
        collection.latest()?.id.value,
      ).toBe("evidence-b");
    },
  );

  it(
    "groups without changing item order",
    () => {
      const first =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-first",
            ),
        });

      const second =
        createEvidence({
          id:
            createEvidenceId(
              "evidence-second",
            ),
          subject: {
            type: "market",
            id: "market-phoenix",
          },
          direction:
            EvidenceDirection.OPPOSING,
          strength:
            EvidenceStrength.MODERATE,
          source: {
            capability:
              "market-intelligence",
            name:
              "market-evidence-policy",
          },
        });

      const collection =
        EvidenceCollection.create([
          first,
          second,
        ]);

      expect(
        collection.groupBySubject()
          .get(
            createEvidenceSubjectKey(
              "property",
              "property-001",
            ),
          )?.toArray(),
      ).toEqual([first]);

      expect(
        collection.groupByDirection()
          .get(
            EvidenceDirection.OPPOSING,
          )?.toArray(),
      ).toEqual([second]);

      expect(
        collection.groupByCapability()
          .get(
            "market-intelligence",
          )?.toArray(),
      ).toEqual([second]);
    },
  );
});
