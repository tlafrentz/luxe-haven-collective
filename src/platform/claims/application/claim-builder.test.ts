import { describe, expect, it } from "vitest";
import { Claim, ClaimStatus } from "../domain";
import { ClaimBuilder } from "./claim-builder";

const claim = Claim.create({
  type: "demo.claim",
  subject: { type: "property", id: "mesa" },
  statement: "Demo",
  status: ClaimStatus.ACTIVE,
  source: { capability: "investment", name: "demo" },
  createdAt: new Date("2026-07-19T00:00:00Z"),
});

describe("ClaimBuilder", () => {
  it("constructs collections without coordinating policies", () => {
    const builder = new ClaimBuilder();

    expect(builder.build([claim]).size).toBe(1);
    expect(builder.build([]).size).toBe(0);
  });
});
