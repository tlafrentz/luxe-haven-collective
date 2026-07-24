import { describe, expect, it } from "vitest";
import { createOutcomeId, createOutcomeOwnerId } from "../domain";
import { planInput, plannedOutcome, t } from "../domain/outcome.test-support";
import { InMemoryOutcomeRepository } from "./in-memory-outcome-repository";

describe("LI-001 in-memory Outcome repository", () => {
  it("saves and immutably rehydrates an owner-scoped aggregate", async () => {
    const repository = new InMemoryOutcomeRepository();
    const outcome = plannedOutcome();
    expect((await repository.save(outcome, null)).isSuccess).toBe(true);
    const loaded = await repository.findById(outcome.ownerId, outcome.id);
    expect(loaded.isSuccess && loaded.value?.props).toEqual(outcome.props);
    if (loaded.isSuccess && loaded.value) loaded.value.startMeasurement({ occurredAt: t(2), idempotencyKey: "not-saved" });
    const again = await repository.findById(outcome.ownerId, outcome.id);
    expect(again.isSuccess && again.value?.status).toBe("planned");
  });

  it("conceals cross-owner reads and scopes origin lookup", async () => {
    const repository = new InMemoryOutcomeRepository();
    const outcome = plannedOutcome();
    await repository.save(outcome, null);
    expect((await repository.findById(createOutcomeOwnerId("other"), outcome.id))).toMatchObject({ isSuccess: true, value: null });
    expect(await repository.existsByOrigin(outcome.ownerId, outcome.props.origin)).toMatchObject({ isSuccess: true, value: true });
    expect(await repository.existsByOrigin(createOutcomeOwnerId("other"), outcome.props.origin)).toMatchObject({ isSuccess: true, value: false });
  });

  it("enforces creation and update versions atomically", async () => {
    const repository = new InMemoryOutcomeRepository();
    const outcome = plannedOutcome();
    await repository.save(outcome, null);
    expect(await repository.save(outcome, null)).toMatchObject({ isFailure: true, error: { code: "OUTCOME_DUPLICATE_ID" } });
    outcome.startMeasurement({ occurredAt: t(2), idempotencyKey: "start" });
    expect(await repository.save(outcome, 0)).toMatchObject({ isFailure: true, error: { code: "OUTCOME_VERSION_CONFLICT", currentVersion: 1 } });
    const unchanged = await repository.findById(outcome.ownerId, outcome.id);
    expect(unchanged.isSuccess && unchanged.value?.version).toBe(1);
    expect((await repository.save(outcome, 1)).isSuccess).toBe(true);
  });

  it("provides bounded, stable decision and subject reads", async () => {
    const repository = new InMemoryOutcomeRepository();
    await repository.save(plannedOutcome(), null);
    await repository.save((await import("../domain")).Outcome.plan(planInput({ id: createOutcomeId("outcome-2"), idempotencyKey: "plan-2", plannedAt: new Date(t(1).getTime() + 1) })), null);
    const decision = await repository.listOutcomesForDecision({ ownerId: createOutcomeOwnerId("owner-1"), decisionId: "decision-1", limit: 1 });
    expect(decision.isSuccess && decision.value.items).toHaveLength(1);
    expect(decision.isSuccess && decision.value.nextCursor).toBe("1");
    const subject = await repository.listOutcomesForSubject({ ownerId: createOutcomeOwnerId("owner-1"), subject: { type: "property", propertyId: "property-1" }, limit: 10 });
    expect(subject.isSuccess && subject.value.items.map(item => item.id.value)).toEqual(["outcome-2", "outcome-1"]);
    await expect(repository.listOutcomesForDecision({ ownerId: createOutcomeOwnerId("owner-1"), decisionId: "decision-1", limit: 101 })).rejects.toThrow(/between 1 and 100/);
  });
});
