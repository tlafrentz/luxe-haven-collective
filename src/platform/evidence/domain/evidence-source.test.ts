import {
  describe,
  expect,
  it,
} from "vitest";

import {
  EvidenceSource,
} from "./evidence-source";

describe("EvidenceSource", () => {
  it(
    "creates a versioned evidence source",
    () => {
      const source =
        EvidenceSource.create({
          capability:
            "investment-intelligence",
          name:
            "investment-evidence-policy",
          version: "1",
        });

      expect(source.capability).toBe(
        "investment-intelligence",
      );
      expect(source.name).toBe(
        "investment-evidence-policy",
      );
      expect(source.version).toBe("1");
      expect(source.isVersioned).toBe(
        true,
      );
    },
  );

  it(
    "supports an unversioned source",
    () => {
      const source =
        EvidenceSource.create({
          capability:
            "market-intelligence",
          name:
            "market-evidence-policy",
        });

      expect(source.version).toBeUndefined();
      expect(source.isVersioned).toBe(
        false,
      );
    },
  );

  it.each([
    [
      {
        capability: " ",
        name: "policy",
      },
      "Evidence source capability cannot be empty.",
    ],
    [
      {
        capability: "investment",
        name: " ",
      },
      "Evidence source name cannot be empty.",
    ],
    [
      {
        capability: "investment",
        name: "policy",
        version: " ",
      },
      "Evidence source version cannot be empty.",
    ],
  ])(
    "rejects invalid source text",
    (
      input,
      message,
    ) => {
      expect(() =>
        EvidenceSource.create(input),
      ).toThrow(message);
    },
  );

  it(
    "compares by complete value",
    () => {
      const first =
        EvidenceSource.create({
          capability:
            "investment-intelligence",
          name:
            "investment-evidence-policy",
          version: "1",
        });

      const second =
        EvidenceSource.create({
          capability:
            "investment-intelligence",
          name:
            "investment-evidence-policy",
          version: "1",
        });

      expect(
        first.equals(second),
      ).toBe(true);
    },
  );
});
