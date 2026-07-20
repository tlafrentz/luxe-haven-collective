import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createEvidenceId,
} from "../../evidence";

import {
  ClaimEvidenceReference,
} from "./claim-evidence-reference";

import {
  ClaimEvidenceRole,
} from "./claim-evidence-role";

describe(
  "ClaimEvidenceReference",
  () => {
    it(
      "creates a primary reference by default",
      () => {
        const reference =
          ClaimEvidenceReference.create({
            evidenceId:
              "evidence-return-below-target",
          });

        expect(
          reference.evidenceId.value,
        ).toBe(
          "evidence-return-below-target",
        );
        expect(reference.role).toBe(
          ClaimEvidenceRole.PRIMARY,
        );
        expect(
          reference.isPrimary,
        ).toBe(true);
      },
    );

    it(
      "supports explicit role and note",
      () => {
        const reference =
          ClaimEvidenceReference.create({
            evidenceId:
              createEvidenceId(
                "evidence-cap-rate",
              ),
            role:
              ClaimEvidenceRole.SUPPORTING,
            note:
              "Supports the return proposition.",
          });

        expect(reference.role).toBe(
          ClaimEvidenceRole.SUPPORTING,
        );
        expect(reference.note).toBe(
          "Supports the return proposition.",
        );
        expect(
          reference.references(
            createEvidenceId(
              "evidence-cap-rate",
            ),
          ),
        ).toBe(true);
      },
    );

    it(
      "rejects an empty note",
      () => {
        expect(() =>
          ClaimEvidenceReference.create({
            evidenceId:
              "evidence-cap-rate",
            note: " ",
          }),
        ).toThrow(
          "Claim evidence reference note cannot be empty.",
        );
      },
    );

    it(
      "compares by complete value",
      () => {
        const first =
          ClaimEvidenceReference.create({
            evidenceId:
              "evidence-cap-rate",
            role:
              ClaimEvidenceRole.PRIMARY,
          });

        const second =
          ClaimEvidenceReference.create({
            evidenceId:
              "evidence-cap-rate",
            role:
              ClaimEvidenceRole.PRIMARY,
          });

        expect(
          first.equals(second),
        ).toBe(true);
      },
    );
  },
);
