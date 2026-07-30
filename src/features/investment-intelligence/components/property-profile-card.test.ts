import { describe, expect, it } from "vitest";

import { propertySyncMessage } from "./property-profile-card";

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
