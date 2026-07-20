import {
  describe,
  expect,
  it,
} from "vitest";

import {
  EvaluationSource,
} from "./evaluation-source";

describe("EvaluationSource", () => {
  it(
    "creates a normalized source",
    () => {
      const source =
        EvaluationSource.create({
          capability:
            " investment-intelligence ",
          name:
            " acquisition-evaluation-policy ",
          version: " 1 ",
        });

      expect(source.capability).toBe(
        "investment-intelligence",
      );
      expect(source.name).toBe(
        "acquisition-evaluation-policy",
      );
      expect(source.version).toBe(
        "1",
      );
    },
  );

  it(
    "omits blank optional version",
    () => {
      const source =
        EvaluationSource.create({
          capability:
            "investment-intelligence",
          name:
            "acquisition-evaluation-policy",
          version: " ",
        });

      expect(
        source.version,
      ).toBeUndefined();
    },
  );

  it(
    "rejects missing identity",
    () => {
      expect(() =>
        EvaluationSource.create({
          capability: " ",
          name:
            "acquisition-evaluation-policy",
        }),
      ).toThrow(
        "Evaluation source capability cannot be empty.",
      );

      expect(() =>
        EvaluationSource.create({
          capability:
            "investment-intelligence",
          name: " ",
        }),
      ).toThrow(
        "Evaluation source name cannot be empty.",
      );
    },
  );

  it(
    "supports source matching",
    () => {
      const source =
        EvaluationSource.create({
          capability:
            "investment-intelligence",
          name:
            "acquisition-evaluation-policy",
        });

      expect(
        source.isFromCapability(
          "investment-intelligence",
        ),
      ).toBe(true);

      expect(
        source.isFrom(
          "investment-intelligence",
          "acquisition-evaluation-policy",
        ),
      ).toBe(true);
    },
  );

  it(
    "compares by complete value",
    () => {
      const input = {
        capability:
          "investment-intelligence",
        name:
          "acquisition-evaluation-policy",
        version: "1",
      };

      expect(
        EvaluationSource.create(
          input,
        ).equals(
          EvaluationSource.create(
            input,
          ),
        ),
      ).toBe(true);
    },
  );
});
