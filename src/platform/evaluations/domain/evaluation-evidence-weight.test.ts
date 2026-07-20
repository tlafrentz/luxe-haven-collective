import {
  describe,
  expect,
  it,
} from "vitest";

import {
  EvaluationEvidenceWeight,
} from "./evaluation-evidence-weight";

describe(
  "EvaluationEvidenceWeight",
  () => {
    it(
      "creates normalized influence weight",
      () => {
        const weight =
          EvaluationEvidenceWeight.create(
            0.82,
          );

        expect(weight.value).toBe(
          0.82,
        );
        expect(
          weight.percentage,
        ).toBe(82);
      },
    );

    it(
      "creates zero and full weights",
      () => {
        expect(
          EvaluationEvidenceWeight.zero()
            .isZero(),
        ).toBe(true);

        expect(
          EvaluationEvidenceWeight.full()
            .isFull(),
        ).toBe(true);
      },
    );

    it(
      "rejects non-finite values",
      () => {
        expect(() =>
          EvaluationEvidenceWeight.create(
            Number.NaN,
          ),
        ).toThrow(
          "Evaluation evidence weight must be finite.",
        );

        expect(() =>
          EvaluationEvidenceWeight.create(
            Number.POSITIVE_INFINITY,
          ),
        ).toThrow(
          "Evaluation evidence weight must be finite.",
        );
      },
    );

    it(
      "rejects values outside zero and one",
      () => {
        expect(() =>
          EvaluationEvidenceWeight.create(
            -0.01,
          ),
        ).toThrow(
          "Evaluation evidence weight must be between 0 and 1.",
        );

        expect(() =>
          EvaluationEvidenceWeight.create(
            1.01,
          ),
        ).toThrow(
          "Evaluation evidence weight must be between 0 and 1.",
        );
      },
    );

    it(
      "compares by value",
      () => {
        expect(
          EvaluationEvidenceWeight.create(
            0.5,
          ).equals(
            EvaluationEvidenceWeight.create(
              0.5,
            ),
          ),
        ).toBe(true);
      },
    );
  },
);
