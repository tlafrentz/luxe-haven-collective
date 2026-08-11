import { describe, expect, it } from "vitest";
import {
  AUTOMATION_COMMAND_ADAPTER_STATES,
  createAutomationCommandAdapterRegistry,
} from "./automation-command-adapter-registry";

describe("production automation command adapter inventory", () => {
  it("supports only Execute draft-plan creation and keeps it production-disabled", () => {
    expect(AUTOMATION_COMMAND_ADAPTER_STATES).toHaveLength(6);
    expect(AUTOMATION_COMMAND_ADAPTER_STATES[0]).toEqual(
      expect.objectContaining({
        capability: "execute",
        implementation: "supported",
        commandTypes: ["createDraftPlan"],
        productionEnabled: false,
      }),
    );
    expect(
      AUTOMATION_COMMAND_ADAPTER_STATES.slice(1).every(
        (item) =>
          item.implementation === "explicitly-unsupported" &&
          !item.productionEnabled,
      ),
    ).toBe(true);
  });

  it("constructs one unique fail-closed port per owning capability", async () => {
    const ports = createAutomationCommandAdapterRegistry({
      execute: {
        authorize: async () => ({ allowed: false }),
        createDraftPlan: async () => ({ classification: "unsupported" }),
        getCommandStatus: async () => ({ classification: "unsupported" }),
      },
    });
    expect(ports.map((port) => port.capability)).toEqual([
      "execute",
      "decide",
      "outcome-measurement",
      "learning",
      "recommendations",
      "furnishing",
    ]);
    expect(new Set(ports.map((port) => port.capability)).size).toBe(ports.length);
  });
});
