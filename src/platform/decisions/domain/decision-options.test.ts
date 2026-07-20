import { describe, expect, it } from "vitest";

import { DecisionOptions } from "./decision-options";

enum AcquisitionOutcome {
  BUY = "buy",
  WAIT = "wait",
  PASS = "pass",
}

const options = [
  {
    key: "wait",
    label: "Wait",
    outcome: AcquisitionOutcome.WAIT,
    rank: 2,
    score: 72,
    summary: "Wait for improved financing.",
  },
  {
    key: "buy",
    label: "Buy",
    outcome: AcquisitionOutcome.BUY,
    rank: 1,
    score: 88,
    summary: "Proceed at the modeled price.",
  },
  {
    key: "pass",
    label: "Pass",
    outcome: AcquisitionOutcome.PASS,
    rank: 3,
    score: 41,
    summary: "Do not acquire under current conditions.",
  },
] as const;

describe("DecisionOptions", () => {
  it("normalizes and ranks options deterministically", () => {
    const collection = new DecisionOptions(options);

    expect(collection.all().map((option) => option.rank)).toEqual([
      1,
      2,
      3,
    ]);
    expect(collection.best().outcome).toBe(
      AcquisitionOutcome.BUY,
    );
    expect(collection.size).toBe(3);
  });

  it("finds options by outcome and rank", () => {
    const collection = new DecisionOptions(options);

    expect(
      collection.find(AcquisitionOutcome.WAIT)?.score,
    ).toBe(72);
    expect(collection.atRank(3)?.outcome).toBe(
      AcquisitionOutcome.PASS,
    );
    expect(collection.has(AcquisitionOutcome.BUY)).toBe(true);
  });

  it("normalizes option text", () => {
    const collection = new DecisionOptions([
      {
        key: " buy ",
        label: " Buy ",
        outcome: AcquisitionOutcome.BUY,
        rank: 1,
        score: 88,
        summary: " Proceed. ",
      },
    ]);

    expect(collection.best()).toEqual({
      key: "buy",
      label: "Buy",
      outcome: AcquisitionOutcome.BUY,
      rank: 1,
      score: 88,
      summary: "Proceed.",
    });
  });

  it("rejects empty options", () => {
    expect(() => new DecisionOptions([])).toThrow(
      "Decision options cannot be empty.",
    );
  });

  it("rejects duplicate keys, outcomes, and ranks", () => {
    expect(() =>
      new DecisionOptions([
        options[0],
        {
          ...options[1],
          key: options[0].key,
        },
      ]),
    ).toThrow("Decision option keys must be unique.");

    expect(() =>
      new DecisionOptions([
        options[0],
        {
          ...options[1],
          outcome: options[0].outcome,
        },
      ]),
    ).toThrow("Decision option outcomes must be unique.");

    expect(() =>
      new DecisionOptions([
        options[0],
        {
          ...options[1],
          rank: options[0].rank,
        },
      ]),
    ).toThrow("Decision option ranks must be unique.");
  });

  it("rejects non-contiguous ranks", () => {
    expect(() =>
      new DecisionOptions([
        {
          ...options[0],
          rank: 2,
        },
      ]),
    ).toThrow(
      "Decision option ranks must be contiguous and start at 1.",
    );
  });

  it("rejects invalid ranks and scores", () => {
    expect(() =>
      new DecisionOptions([
        {
          ...options[0],
          rank: 0,
        },
      ]),
    ).toThrow(
      "Decision option rank must be a positive integer.",
    );

    expect(() =>
      new DecisionOptions([
        {
          ...options[0],
          rank: 1,
          score: 101,
        },
      ]),
    ).toThrow(
      "Decision option score must be between 0 and 100.",
    );
  });

  it("protects itself from source mutation", () => {
    const source = [
      {
        key: "buy",
        label: "Buy",
        outcome: AcquisitionOutcome.BUY,
        rank: 1,
        score: 88,
        summary: "Proceed.",
      },
    ];

    const collection = new DecisionOptions(source);
    source[0].score = 10;

    expect(collection.best().score).toBe(88);
  });
});
