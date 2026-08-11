import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const processProductionAutomation = vi.fn();
const requestProductionManualAutomation = vi.fn();
const readProductionAutomationRuntimeConfig = vi.fn();

vi.mock("@/platform/automations", () => ({
  processProductionAutomation,
  requestProductionManualAutomation,
  readProductionAutomationRuntimeConfig,
}));

const { POST } = await import("./route");

describe("protected production Automation processor route", () => {
  beforeEach(() => {
    process.env.AUTOMATION_SCHEDULER_SECRET = "scheduler-secret";
    readProductionAutomationRuntimeConfig.mockReturnValue({
      globalKillSwitch: false,
      workspaceKillSwitch: false,
    });
    requestProductionManualAutomation.mockResolvedValue({
      accepted: true,
      occurrenceId: "occurrence-1",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTOMATION_SCHEDULER_SECRET;
  });

  it("rejects browser and unauthenticated callers", async () => {
    const response = await POST(
      new NextRequest("https://example.test/api/internal/automations/process", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    expect(requestProductionManualAutomation).not.toHaveBeenCalled();
  });

  it("accepts only the configured protected manual trigger path", async () => {
    const response = await POST(
      new NextRequest("https://example.test/api/internal/automations/process", {
        method: "POST",
        headers: {
          authorization: "Bearer scheduler-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "manual", idempotencyKey: "proof-1" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(requestProductionManualAutomation).toHaveBeenCalledWith(
      expect.any(String),
      "proof-1",
      expect.objectContaining({ globalKillSwitch: false }),
    );
    expect(processProductionAutomation).not.toHaveBeenCalled();
  });
});
