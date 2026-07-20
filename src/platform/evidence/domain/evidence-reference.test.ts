import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createObservationId,
} from "../../observations";

import {
  EvidenceReference,
} from "./evidence-reference";

import {
  EvidenceReferenceRole,
} from "./evidence-reference-role";

describe("EvidenceReference", () => {
  it(
    "creates a primary observation reference by default",
    () => {
      const reference =
        EvidenceReference.create({
          observationId:
            "observation-cap-rate",
        });

      expect(
        reference.observationId.value,
      ).toBe(
        "observation-cap-rate",
      );
      expect(reference.role).toBe(
        EvidenceReferenceRole.PRIMARY,
      );
      expect(reference.isPrimary).toBe(
        true,
      );
    },
  );

  it(
    "supports a role and explanatory note",
    () => {
      const reference =
        EvidenceReference.create({
          observationId:
            createObservationId(
              "observation-market-adr",
            ),
          role:
            EvidenceReferenceRole.SUPPORTING,
          note:
            "Used as the market baseline.",
        });

      expect(reference.role).toBe(
        EvidenceReferenceRole.SUPPORTING,
      );
      expect(reference.note).toBe(
        "Used as the market baseline.",
      );
      expect(
        reference.references(
          createObservationId(
            "observation-market-adr",
          ),
        ),
      ).toBe(true);
    },
  );

  it(
    "rejects an empty note",
    () => {
      expect(() =>
        EvidenceReference.create({
          observationId:
            "observation-cap-rate",
          note: " ",
        }),
      ).toThrow(
        "Evidence reference note cannot be empty.",
      );
    },
  );

  it(
    "compares by complete value",
    () => {
      const first =
        EvidenceReference.create({
          observationId:
            "observation-cap-rate",
          role:
            EvidenceReferenceRole.PRIMARY,
        });

      const second =
        EvidenceReference.create({
          observationId:
            "observation-cap-rate",
          role:
            EvidenceReferenceRole.PRIMARY,
        });

      expect(
        first.equals(second),
      ).toBe(true);
    },
  );
});
