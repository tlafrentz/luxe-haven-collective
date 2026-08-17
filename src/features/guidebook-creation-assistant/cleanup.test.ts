import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creationCleanupEligibility } from "./cleanup";

describe("Creation Assistant cleanup eligibility", () => {
  it.each(["failed", "cancelled", "completed"])(
    "permits terminal %s jobs",
    (state) => {
      expect(
        creationCleanupEligibility({ id: "job", state, guidebook_id: null }),
      ).toEqual({ allowed: true, archiveGuidebook: false });
    },
  );

  it("requires canonical archival when the assistant created a guidebook", () => {
    expect(
      creationCleanupEligibility({
        id: "job",
        state: "completed",
        guidebook_id: "guidebook",
      }),
    ).toEqual({ allowed: true, archiveGuidebook: true });
  });

  it("blocks cleanup while provider evidence requires reconciliation", () => {
    expect(creationCleanupEligibility({id:"job",state:"failed",guidebook_id:null,failure_class:"reconciliation_required"})).toEqual({allowed:false,archiveGuidebook:false});
  });

  it("never deletes append-only provider evidence during full resource cleanup",()=>{const source=readFileSync("src/features/guidebook-creation-assistant/cleanup.ts","utf8");expect(source).not.toContain("guidebook_creation_provider_evidence");expect(source).not.toContain("guidebook_creation_provider_evidence_outcomes")});

  it.each(["draft", "uploading", "extracting", "generating"])(
    "rejects non-terminal %s jobs",
    (state) => {
      expect(
        creationCleanupEligibility({ id: "job", state, guidebook_id: null }),
      ).toEqual({ allowed: false, archiveGuidebook: false });
    },
  );
});
