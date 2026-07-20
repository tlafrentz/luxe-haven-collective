import { describe, expect, it, vi } from "vitest";

import { Action, createActionId } from "@/platform/actions";
import { Identifier } from "@/platform/kernel";

import { executeIntegrationAction, type OutboundActionProvider } from "./action-execution-adapter";
import { inboundRecordsToObservations } from "./inbound-observation-adapter";
import { DEFAULT_INTEGRATION_PROVIDERS, IntegrationProviderRegistry } from "./provider-registry";

describe("Integration provider boundaries", () => {
  it("declares and resolves transport capabilities without business policy", () => {
    expect(DEFAULT_INTEGRATION_PROVIDERS.supporting("read-reservations").map((value) => value.id)).toEqual(["hospitable"]);
    expect(DEFAULT_INTEGRATION_PROVIDERS.supporting("provide-valuations").map((value) => value.id)).toEqual(["rentcast"]);
    expect(() => new IntegrationProviderRegistry().register({ id: "provider", displayName: "One", capabilities: [], normalizationVersion: "v1" }).register({ id: "provider", displayName: "Two", capabilities: [], normalizationVersion: "v1" })).toThrow(/already registered/);
  });

  it("preserves complete inbound provenance on Platform Observations", () => {
    const observations = inboundRecordsToObservations([{
      value: { type: "integration.reservation-total", label: "Reservation total", value: 725, subject: { type: "property", id: "property-1" }, unit: { type: "currency", symbol: "USD" } },
      provenance: {
        provider: "hospitable", externalRecordId: "reservation-1",
        retrievedAt: new Date("2026-07-19T12:00:00Z"), effectiveAt: new Date("2026-07-20T00:00:00Z"),
        operation: "GET /reservations/{id}", normalizationVersion: "hospitable-v1",
        syncRunId: "sync-1", propertyId: "property-1", rawPayloadReference: "bookings:reservation-1:raw_payload",
      },
    }]);
    const observation = observations.toArray()[0];
    expect(observation.source.name).toBe("hospitable");
    expect(observation.source.referenceId).toBe("reservation-1");
    expect(observation.metadata).toMatchObject({ syncRunId: "sync-1", normalizationVersion: "hospitable-v1" });
  });

  it("executes an approved Action idempotently and produces only a technical Outcome", async () => {
    const decisionId = Identifier.create("decision-pricing-1");
    const action = Action.create({
      id: createActionId("action-pricing-1"), title: "Publish pricing", summary: "Publish approved weekend pricing.",
      type: "pricing", priority: "high", owner: { type: "automation", id: "integration", displayName: "Integration" },
      decisionIds: [decisionId], createdAt: new Date("2026-07-19T10:00:00Z"),
    }).accept(new Date("2026-07-19T10:01:00Z"));
    const execute = vi.fn().mockResolvedValue({ successful: true, externalExecutionId: "request-1", statusCode: 200, message: "Provider accepted the request.", startedAt: new Date("2026-07-19T10:02:00Z"), completedAt: new Date("2026-07-19T10:02:01Z") });
    const provider: OutboundActionProvider = {
      provider: "pricing-provider", supportedActionTypes: ["pricing"],
      map: (value) => ({ provider: "pricing-provider", operation: "update-pricing", idempotencyKey: value.id.value, payload: { propertyId: "property-1" } }),
      execute,
    };
    const execution = await executeIntegrationAction(action, provider);
    expect(execute).toHaveBeenCalledOnce();
    expect(execution.command.idempotencyKey).toBe(action.id.value);
    expect(execution.technicalOutcome.traces(action.id)).toBe(true);
    expect(execution.technicalOutcome.traces(decisionId)).toBe(true);
    expect(execution.technicalOutcome.metadata.technicalOutcome).toBe(true);
    expect(execution.technicalOutcome.metrics).toEqual({});
  });

  it("rejects unapproved or unsupported Actions before provider execution", async () => {
    const action = Action.create({ id: createActionId("action-message-1"), title: "Send message", summary: "Send approved message.", type: "messaging", priority: "medium", owner: { type: "user", id: "operator", displayName: "Operator" }, decisionIds: [Identifier.create("decision-1")], createdAt: new Date() });
    const provider: OutboundActionProvider = { provider: "hospitable", supportedActionTypes: [], map: () => { throw new Error("not called"); }, execute: async () => { throw new Error("not called"); } };
    await expect(executeIntegrationAction(action, provider)).rejects.toThrow(/status "proposed"/);
  });
});
