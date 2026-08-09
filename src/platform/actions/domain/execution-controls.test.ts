import { describe, expect, it } from "vitest";
import {
  assertDependencyCanBeAdded,
  reviewEvidence,
  validateEvidencePolicy,
  type ActionDependency,
  type ActionEvidence,
} from "./execution-controls";

const evidence = (overrides: Partial<ActionEvidence> = {}): ActionEvidence => ({
  id: "e-1",
  workspaceId: "w",
  actionId: "a",
  type: "photo",
  status: "submitted",
  caption: "before and after",
  createdBy: "u",
  createdAt: new Date(),
  ...overrides,
});
describe("EX-001B2 evidence and dependency policies", () => {
  it("evaluates specific evidence and review requirements deterministically", () => {
    expect(
      validateEvidencePolicy(
        {
          mode: "specific",
          requiredTypes: ["photo"],
          minimumPhotoCount: 1,
          beforeAndAfterPhotos: true,
          reviewRequired: true,
        },
        [evidence()],
        true,
      ),
    ).toMatchObject({ satisfied: false, reviewRequired: true });
    expect(
      validateEvidencePolicy(
        {
          mode: "specific",
          requiredTypes: ["photo"],
          minimumPhotoCount: 1,
          beforeAndAfterPhotos: true,
          reviewRequired: true,
        },
        [evidence({ status: "accepted" })],
        true,
      ).satisfied,
    ).toBe(true);
  });
  it("requires a reason when evidence is rejected", () => {
    expect(() =>
      reviewEvidence(evidence(), {
        accepted: false,
        actor: { type: "user", id: "r" },
        occurredAt: new Date(),
      }),
    ).toThrow(/reason/);
    expect(
      reviewEvidence(evidence(), {
        accepted: false,
        reason: "Wrong room",
        actor: { type: "user", id: "r" },
        occurredAt: new Date(),
      }).status,
    ).toBe("rejected");
  });
  it("rejects self and indirect dependency cycles", () => {
    const dependencies: ActionDependency[] = [
      {
        workspaceId: "w",
        actionId: "b",
        dependsOnActionId: "c",
        createdById: "u",
        createdAt: new Date(),
      },
      {
        workspaceId: "w",
        actionId: "c",
        dependsOnActionId: "a",
        createdById: "u",
        createdAt: new Date(),
      },
    ];
    expect(() => assertDependencyCanBeAdded("a", "a", [])).toThrow(/itself/);
    expect(() => assertDependencyCanBeAdded("a", "b", dependencies)).toThrow(
      /cycle/,
    );
  });
});
