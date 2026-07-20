import { describe, expect, it } from "vitest";
import { Claim, ClaimStatus } from "../domain";
import { ClaimExecutor } from "./claim-executor";
import type { ClaimPolicy } from "./claim-policy";

const policy: ClaimPolicy<{ flag: boolean }> = {
  name: "demo",
  capability: "investment",
  applies: (input) => input.flag,
  build: () => [Claim.create({
    type: "demo.claim",
    subject: { type: "property", id: "mesa" },
    statement: "Demo",
    status: ClaimStatus.ACTIVE,
    source: { capability: "investment", name: "demo" },
    createdAt: new Date("2026-07-19T00:00:00Z"),
  })],
};

describe("ClaimExecutor", () => {
  it("coordinates applicable policies", () => {
    const executor = new ClaimExecutor([policy]);

    expect(executor.execute({ flag: true }).size).toBe(1);
    expect(executor.execute({ flag: false }).size).toBe(0);
  });
});
