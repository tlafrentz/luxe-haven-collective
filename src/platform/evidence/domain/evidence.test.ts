import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createObservationId,
  ObservationSubject,
} from "../../observations";

import {
  EvidenceDirection,
} from "./evidence-direction";

import {
  createEvidenceId,
} from "./evidence-id";

import {
  EvidenceSource,
} from "./evidence-source";

import {
  EvidenceStrength,
} from "./evidence-strength";

import {
  Evidence,
} from "./evidence";

function createInput() {
  return {
    type:
      "investment.financial.cap-rate-below-target",
    subject: {
      type: "property",
      id: "property-001",
    },
    title:
      "Cap rate is below target",
    explanation:
      "The projected cap rate is below the active acquisition threshold.",
    direction:
      EvidenceDirection.OPPOSING,
    strength:
      EvidenceStrength.STRONG,
    source: {
      capability:
        "investment-intelligence",
      name:
        "investment-evidence-policy",
      version: "1",
    },
    observationIds: [
      createObservationId(
        "observation-cap-rate",
      ),
    ],
    createdAt:
      new Date(
        "2026-07-19T18:00:00.000Z",
      ),
    metadata: {
      threshold: 8,
      actual: 5.34,
    },
  } as const;
}

describe("Evidence", () => {
  it(
    "creates canonical evidence with generated identity",
    () => {
      const evidence =
        Evidence.create(
          createInput(),
        );

      expect(
        evidence.id.value,
      ).toMatch(
        /^evidence-/,
      );
      expect(evidence.type).toBe(
        "investment.financial.cap-rate-below-target",
      );
      expect(evidence.subject.type).toBe(
        "property",
      );
      expect(evidence.subject.id).toBe(
        "property-001",
      );
      expect(evidence.title).toBe(
        "Cap rate is below target",
      );
      expect(
        evidence.explanation,
      ).toBe(
        "The projected cap rate is below the active acquisition threshold.",
      );
      expect(evidence.direction).toBe(
        EvidenceDirection.OPPOSING,
      );
      expect(evidence.strength).toBe(
        EvidenceStrength.STRONG,
      );
      expect(
        evidence.source.capability,
      ).toBe(
        "investment-intelligence",
      );
      expect(evidence.source.name).toBe(
        "investment-evidence-policy",
      );
      expect(
        evidence.source.version,
      ).toBe("1");
      expect(
        evidence.observationIds,
      ).toHaveLength(1);
      expect(
        evidence.createdAt.toISOString(),
      ).toBe(
        "2026-07-19T18:00:00.000Z",
      );
      expect(evidence.metadata).toEqual({
        threshold: 8,
        actual: 5.34,
      });
    },
  );

  it(
    "preserves an explicit identity",
    () => {
      const id =
        createEvidenceId(
          "evidence-explicit",
        );

      const evidence =
        Evidence.create({
          ...createInput(),
          id,
        });

      expect(
        evidence.id.equals(id),
      ).toBe(true);
    },
  );

  it(
    "accepts canonical subject and source value objects",
    () => {
      const subject =
        ObservationSubject.create({
          type: "property",
          id: "property-001",
        });

      const source =
        EvidenceSource.create({
          capability:
            "investment-intelligence",
          name:
            "investment-evidence-policy",
        });

      const evidence =
        Evidence.create({
          ...createInput(),
          subject,
          source,
        });

      expect(
        evidence.subject.equals(subject),
      ).toBe(true);
      expect(
        evidence.source.equals(source),
      ).toBe(true);
    },
  );

  it.each([
    [
      "type",
      {
        type: " ",
      },
      "Evidence type cannot be empty.",
    ],
    [
      "title",
      {
        title: " ",
      },
      "Evidence title cannot be empty.",
    ],
    [
      "explanation",
      {
        explanation: " ",
      },
      "Evidence explanation cannot be empty.",
    ],
  ])(
    "rejects an empty %s",
    (
      _field,
      replacement,
      message,
    ) => {
      expect(() =>
        Evidence.create({
          ...createInput(),
          ...replacement,
        }),
      ).toThrow(message);
    },
  );

  it(
    "requires at least one observation reference",
    () => {
      expect(() =>
        Evidence.create({
          ...createInput(),
          observationIds: [],
        }),
      ).toThrow(
        "Evidence must reference at least one observation.",
      );
    },
  );

  it(
    "deduplicates observation references by value",
    () => {
      const first =
        createObservationId(
          "observation-cap-rate",
        );

      const evidence =
        Evidence.create({
          ...createInput(),
          observationIds: [
            first,
            createObservationId(
              "observation-cap-rate",
            ),
          ],
        });

      expect(
        evidence.observationIds,
      ).toHaveLength(1);
      expect(
        evidence.references(first),
      ).toBe(true);
    },
  );

  it(
    "protects observation references from source-array mutation",
    () => {
      const observationIds = [
        createObservationId(
          "observation-cap-rate",
        ),
      ];

      const evidence =
        Evidence.create({
          ...createInput(),
          observationIds,
        });

      observationIds.push(
        createObservationId(
          "observation-later",
        ),
      );

      expect(
        evidence.observationIds,
      ).toHaveLength(1);
    },
  );

  it(
    "returns a copy of observation references",
    () => {
      const evidence =
        Evidence.create(
          createInput(),
        );

      const observationIds =
        evidence.observationIds as
          ReturnType<
            typeof createObservationId
          >[];

      observationIds.push(
        createObservationId(
          "observation-later",
        ),
      );

      expect(
        evidence.observationIds,
      ).toHaveLength(1);
    },
  );

  it(
    "rejects an invalid creation date",
    () => {
      expect(() =>
        Evidence.create({
          ...createInput(),
          createdAt:
            new Date("invalid"),
        }),
      ).toThrow(
        "Evidence createdAt must be valid.",
      );
    },
  );

  it(
    "defensively copies the creation date",
    () => {
      const createdAt =
        new Date(
          "2026-07-19T18:00:00.000Z",
        );

      const evidence =
        Evidence.create({
          ...createInput(),
          createdAt,
        });

      createdAt.setUTCFullYear(2030);

      expect(
        evidence.createdAt.toISOString(),
      ).toBe(
        "2026-07-19T18:00:00.000Z",
      );

      const returned =
        evidence.createdAt;

      returned.setUTCFullYear(2035);

      expect(
        evidence.createdAt.toISOString(),
      ).toBe(
        "2026-07-19T18:00:00.000Z",
      );
    },
  );

  it(
    "protects metadata from external mutation",
    () => {
      const metadata: {
        actual: number;
        notes?: string;
      } = {
        actual: 5.34,
      };

      const evidence =
        Evidence.create({
          ...createInput(),
          metadata,
        });

      metadata.actual = 10;
      metadata.notes =
        "Later mutation";

      expect(evidence.metadata).toEqual({
        actual: 5.34,
      });
      expect(
        Object.isFrozen(
          evidence.metadata,
        ),
      ).toBe(true);
    },
  );

  it(
    "reports evidence direction",
    () => {
      const supporting =
        Evidence.create({
          ...createInput(),
          direction:
            EvidenceDirection.SUPPORTING,
        });

      const opposing =
        Evidence.create({
          ...createInput(),
          direction:
            EvidenceDirection.OPPOSING,
        });

      const neutral =
        Evidence.create({
          ...createInput(),
          direction:
            EvidenceDirection.NEUTRAL,
        });

      const mixed =
        Evidence.create({
          ...createInput(),
          direction:
            EvidenceDirection.MIXED,
        });

      expect(
        supporting.supports(),
      ).toBe(true);
      expect(
        opposing.opposes(),
      ).toBe(true);
      expect(
        neutral.isNeutral(),
      ).toBe(true);
      expect(
        mixed.isMixed(),
      ).toBe(true);
    },
  );

  it(
    "matches its subject and observation references",
    () => {
      const evidence =
        Evidence.create(
          createInput(),
        );

      expect(
        evidence.concerns(
          "property",
          "property-001",
        ),
      ).toBe(true);

      expect(
        evidence.references(
          createObservationId(
            "observation-cap-rate",
          ),
        ),
      ).toBe(true);

      expect(
        evidence.references(
          createObservationId(
            "observation-other",
          ),
        ),
      ).toBe(false);
    },
  );
});
