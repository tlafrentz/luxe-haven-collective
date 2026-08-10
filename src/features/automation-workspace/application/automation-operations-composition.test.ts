import { afterEach, describe, expect, it } from "vitest";
import { automationOperationsFlags } from "./automation-operations-composition";
const keys = [
  "AUTOMATION_OPERATIONS_ENABLED",
  "AUTOMATION_HEALTH_ENABLED",
  "AUTOMATION_REPORTING_ENABLED",
  "AUTOMATION_EXPORTS_ENABLED",
  "AUTOMATION_OPERATOR_COMMANDS_ENABLED",
  "AUTOMATION_RECONCILIATION_WORKER_ENABLED",
  "AUTOMATION_NOTIFICATION_PROCESSING_ENABLED",
  "AUTOMATION_GLOBAL_KILL_SWITCH",
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
describe("AU-001E server configuration", () => {
  it("fails closed when flags are absent", () => {
    for (const key of keys) delete process.env[key];
    expect(automationOperationsFlags()).toEqual({
      visibility: false,
      health: false,
      reports: false,
      exports: false,
      commands: false,
      reconciliationWorker: false,
      notificationProcessing: false,
      killSwitch: false,
    });
  });
  it("keeps inspection configured while the kill switch disables mutations and workers", () => {
    for (const key of keys) process.env[key] = "true";
    expect(automationOperationsFlags()).toMatchObject({
      visibility: true,
      health: true,
      reports: true,
      exports: true,
      commands: false,
      reconciliationWorker: false,
      notificationProcessing: false,
      killSwitch: true,
    });
  });
});
