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

  it.each(["draft", "uploading", "extracting", "generating"])(
    "rejects non-terminal %s jobs",
    (state) => {
      expect(
        creationCleanupEligibility({ id: "job", state, guidebook_id: null }),
      ).toEqual({ allowed: false, archiveGuidebook: false });
    },
  );
});
