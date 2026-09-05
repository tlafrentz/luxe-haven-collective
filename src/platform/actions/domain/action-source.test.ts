import { describe, expect, it } from "vitest";
import { createActionSource } from "./action-source";

const actor = { type: "user", id: "user-1" } as const;
const recordedAt = new Date("2026-07-20T10:00:00.000Z");

describe("createActionSource", () => {
  it("accepts a source with sourceModule and requiredPrivilege set", () => {
    const source = createActionSource({
      type: "decision", sourceId: "decision-1", capability: "portfolio",
      sourceModule: "portfolio", requiredPrivilege: "portfolio.decision.approve",
      recordedAt, recordedBy: actor,
    });
    expect(source.sourceModule).toBe("portfolio");
    expect(source.requiredPrivilege).toBe("portfolio.decision.approve");
  });

  it("omits sourceModule and requiredPrivilege cleanly when absent", () => {
    const source = createActionSource({ type: "manual", recordedAt, recordedBy: actor });
    expect("sourceModule" in source).toBe(false);
    expect("requiredPrivilege" in source).toBe(false);
  });

  it("rejects a whitespace-only sourceModule", () => {
    expect(() => createActionSource({ type: "manual", sourceModule: "   ", recordedAt, recordedBy: actor }))
      .toThrow("Action source module must be a non-empty string when provided.");
  });

  it("rejects a whitespace-only requiredPrivilege", () => {
    expect(() => createActionSource({ type: "manual", requiredPrivilege: "   " as never, recordedAt, recordedBy: actor }))
      .toThrow("Action source required privilege must be a non-empty string when provided.");
  });
});
