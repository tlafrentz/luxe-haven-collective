import { describe, expect, it, vi } from "vitest";
import { createOutcomeOwnerId } from "../domain";
import { planInput, t } from "../domain/outcome.test-support";
import { InMemoryOutcomeRepository } from "../infrastructure";
import type { OutcomeAuthorization } from "./contracts";
import { planOutcome, startOutcomeMeasurement } from "./services";

const allow: OutcomeAuthorization = {
  canReadOutcome: async () => true, canCreateOutcome: async () => true, canModifyOutcome: async () => true,
};

describe("LI-001 Outcome application services", () => {
  it("authorizes creation, rejects duplicate origin, and persists version one", async () => {
    const repository = new InMemoryOutcomeRepository();
    const first = await planOutcome({ repository, authorization: allow }, planInput());
    expect(first.isSuccess && first.value.version).toBe(1);
    const duplicate = await planOutcome({ repository, authorization: allow }, planInput({ id: (await import("../domain")).createOutcomeId("another"), idempotencyKey: "another" }));
    expect(duplicate).toEqual({ isSuccess: false, isFailure: true, error: { code: "OUTCOME_DUPLICATE_ORIGIN" } });
  });

  it("authorizes before sensitive reads", async () => {
    const repository = new InMemoryOutcomeRepository();
    const find = vi.spyOn(repository, "findById");
    const denied: OutcomeAuthorization = { ...allow, canModifyOutcome: async () => false };
    const result = await startOutcomeMeasurement({ repository, authorization: denied }, {
      ownerId: createOutcomeOwnerId("owner-1"), outcomeId: planInput().id, expectedVersion: 1, startedAt: t(2), idempotencyKey: "start",
    });
    expect(result).toMatchObject({ isFailure: true, error: { code: "OUTCOME_NOT_AUTHORIZED" } });
    expect(find).not.toHaveBeenCalled();
  });

  it("loads and saves once, maps stale versions, and safely repeats accepted commands", async () => {
    const repository = new InMemoryOutcomeRepository();
    const planned = await planOutcome({ repository, authorization: allow }, planInput());
    expect(planned.isSuccess).toBe(true);
    const command = { ownerId: createOutcomeOwnerId("owner-1"), outcomeId: planInput().id, expectedVersion: 1, startedAt: t(2), idempotencyKey: "start" };
    const first = await startOutcomeMeasurement({ repository, authorization: allow }, command);
    expect(first.isSuccess && first.value.version).toBe(2);
    const repeated = await startOutcomeMeasurement({ repository, authorization: allow }, command);
    expect(repeated.isSuccess && repeated.value.version).toBe(2);
    const stale = await startOutcomeMeasurement({ repository, authorization: allow }, { ...command, idempotencyKey: "new-key" });
    expect(stale).toMatchObject({ isFailure: true, error: { code: "OUTCOME_VERSION_CONFLICT", currentVersion: 2 } });
  });

  it("conceals missing and cross-owner outcomes as not found after authorization", async () => {
    const repository = new InMemoryOutcomeRepository();
    const result = await startOutcomeMeasurement({ repository, authorization: allow }, {
      ownerId: createOutcomeOwnerId("other"), outcomeId: planInput().id, expectedVersion: 1, startedAt: t(2), idempotencyKey: "start",
    });
    expect(result).toMatchObject({ isFailure: true, error: { code: "OUTCOME_NOT_FOUND" } });
  });
});
