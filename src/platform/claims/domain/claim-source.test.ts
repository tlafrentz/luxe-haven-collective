import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ClaimSource,
} from "./claim-source";

describe("ClaimSource", () => {
  it(
    "creates a normalized claim source",
    () => {
      const source =
        ClaimSource.create({
          capability:
            " investment-intelligence ",
          name:
            " acquisition-claim-policy ",
          version: " 1 ",
        });

      expect(source.capability).toBe(
        "investment-intelligence",
      );
      expect(source.name).toBe(
        "acquisition-claim-policy",
      );
      expect(source.version).toBe(
        "1",
      );
    },
  );

  it(
    "omits a blank optional version",
    () => {
      const source =
        ClaimSource.create({
          capability:
            "investment-intelligence",
          name:
            "acquisition-claim-policy",
          version: " ",
        });

      expect(
        source.version,
      ).toBeUndefined();
    },
  );

  it(
    "rejects missing source identity",
    () => {
      expect(() =>
        ClaimSource.create({
          capability: " ",
          name:
            "acquisition-claim-policy",
        }),
      ).toThrow(
        "Claim source capability cannot be empty.",
      );

      expect(() =>
        ClaimSource.create({
          capability:
            "investment-intelligence",
          name: " ",
        }),
      ).toThrow(
        "Claim source name cannot be empty.",
      );
    },
  );

  it(
    "supports source matching helpers",
    () => {
      const source =
        ClaimSource.create({
          capability:
            "investment-intelligence",
          name:
            "acquisition-claim-policy",
        });

      expect(
        source.isFromCapability(
          "investment-intelligence",
        ),
      ).toBe(true);

      expect(
        source.isFrom(
          "investment-intelligence",
          "acquisition-claim-policy",
        ),
      ).toBe(true);

      expect(
        source.isFrom(
          "market-intelligence",
          "market-claim-policy",
        ),
      ).toBe(false);
    },
  );

  it(
    "compares by complete value",
    () => {
      const input = {
        capability:
          "investment-intelligence",
        name:
          "acquisition-claim-policy",
        version: "1",
      };

      expect(
        ClaimSource.create(
          input,
        ).equals(
          ClaimSource.create(input),
        ),
      ).toBe(true);
    },
  );
});
