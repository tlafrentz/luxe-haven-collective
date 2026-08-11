import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOMATION_OPERATIONS_POLICY } from "../operations";
import { evaluateAutomationOperationalReadiness } from "./automation-operational-readiness";

const complete = () => ({
  dashboards: {
    health: "https://observability.example/health",
    queues: "https://observability.example/queues",
    incidents: "https://observability.example/incidents",
    delivery: "https://observability.example/delivery",
  },
  policy: DEFAULT_AUTOMATION_OPERATIONS_POLICY,
  owners: [
    { name: "Release Owner", role: "release" as const, escalationTarget: "release-on-call" },
    { name: "Operations Owner", role: "operations" as const, escalationTarget: "operations-on-call" },
    { name: "Security Owner", role: "security" as const, escalationTarget: "security-on-call" },
    { name: "Database Owner", role: "database" as const, escalationTarget: "database-on-call" },
  ],
  alertDelivery: {
    channel: "in-app",
    destination: "release-operations",
    verificationId: "verification-1",
    verifiedAt: "2026-08-10T12:00:00.000Z",
  },
});

describe("automation operational readiness", () => {
  it("requires dashboards, named owners, thresholds, and verified delivery", () => {
    expect(evaluateAutomationOperationalReadiness(complete())).toEqual({
      ready: true,
      blockers: [],
    });
  });

  it("fails closed when operational evidence is placeholder or incomplete", () => {
    const input = complete();
    expect(
      evaluateAutomationOperationalReadiness({
        ...input,
        dashboards: { ...input.dashboards, queues: "" },
        owners: input.owners.filter((owner) => owner.role !== "security"),
        alertDelivery: { channel: "in-app", destination: "release-operations" },
      }),
    ).toEqual({
      ready: false,
      blockers: [
        "dashboard_queues_unconfigured",
        "owner_security_unconfigured",
        "alert_delivery_unverified",
      ],
    });
  });
});
