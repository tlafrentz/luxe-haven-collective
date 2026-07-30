import { describe, expect, it } from "vitest";

import { propertySyncFeedback, propertySyncMessage } from "./property-profile-card";

describe("property sync messaging", () => {
  it.each([
    ["complete", "synced successfully"],
    ["coordinates-missing", "coordinates were unavailable"],
    ["str-unavailable", "STR market data was unavailable"],
    ["str-limited", "limited comparable evidence"],
  ] as const)("communicates %s separately", (status, message) => {
    expect(propertySyncMessage(status)).toContain(message);
  });
});

it("replaces a provider failure banner after successful RealtyAPI resolution", () => {
  const failed = propertySyncFeedback({
    ok: false,
    code: "PROPERTY_PROVIDER_UNAVAILABLE",
    message: "Property intelligence is temporarily unavailable. Manual analysis remains available.",
    manualFallbackAvailable: true,
  });
  const resolved = propertySyncFeedback({
    ok: true,
    status: "str-unavailable",
    data: {
      subjectPropertyId: "subject-1",
      subjectPropertySnapshotId: "snapshot-1",
      propertySource: "RealtyAPI",
      warnings: [],
    },
  });

  expect(failed).toMatchObject({ type: "error", text: expect.stringContaining("temporarily unavailable") });
  expect(resolved).toMatchObject({ type: "success", text: expect.not.stringContaining("temporarily unavailable") });
});
