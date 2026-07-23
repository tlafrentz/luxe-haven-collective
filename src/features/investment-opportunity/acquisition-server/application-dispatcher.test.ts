import { describe, expect, it } from "vitest";
import { InMemoryInvestmentOpportunityRepository } from "@/features/investment-opportunity/infrastructure";
import {
  InvestmentOpportunity,
  createInvestmentOpportunityId,
  createOpportunityAnalysisId,
  createOpportunityOwnerId,
} from "@/features/investment-opportunity/domain";
import {
  InMemoryAcquisitionCommandReceiptRepository,
  InMemoryAcquisitionUnitOfWork,
  createInMemoryAcquisitionContext,
} from "@/features/investment-opportunity/acquisition-pipeline/application";
import { InMemoryAcquisitionPipelineRepository } from "@/features/investment-opportunity/acquisition-pipeline";
import { ProductionAcquisitionServerApplicationDispatcher, type TrustedAcquisitionCommandContext } from "./application-dispatcher";
import type { ActivateAcquisitionPipelineServerInput } from "./contracts";

const ownerId = "owner-command-dispatcher";
const actor = { type: "user" as const, id: ownerId };
const at = new Date("2026-07-23T16:00:00.000Z");
const opportunityId = createInvestmentOpportunityId("investment-opportunity-command-dispatcher");
const analysisId = createOpportunityAnalysisId("opportunity-analysis-command-dispatcher");
const input: ActivateAcquisitionPipelineServerInput = {
  commandType: "activate-pipeline",
  envelope: { opportunityId: opportunityId.value, expectedOpportunityVersion: 1, idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" },
  analysisId: analysisId.value,
  analysisVersion: 1,
  route: "purchase",
};

async function fixture() {
  const opportunities = new InMemoryInvestmentOpportunityRepository();
  const pipelines = new InMemoryAcquisitionPipelineRepository();
  const receipts = new InMemoryAcquisitionCommandReceiptRepository();
  const opportunity = InvestmentOpportunity.create({
    id: opportunityId,
    ownerId: createOpportunityOwnerId(ownerId),
    name: "Command opportunity",
    route: "purchase",
    property: { normalizedAddress: { address1: "1 Main St", city: "Mesa", state: "AZ", postalCode: "85201" }, displayAddress: "1 Main St, Mesa", resolutionStatus: "user-supplied", capturedAt: at },
    actor,
    occurredAt: at,
  });
  await opportunities.save(opportunity);
  const unitOfWork = new InMemoryAcquisitionUnitOfWork(createInMemoryAcquisitionContext({ acquisitionPipelines: pipelines, investmentOpportunities: opportunities, commandReceipts: receipts }));
  const dispatcher = new ProductionAcquisitionServerApplicationDispatcher({
    unitOfWork,
    authorization: { authorize: async ({ actor: candidate, ownerId: owner }) => ({ allowed: candidate.id === owner.value }) },
    analysisReader: { getCompletedAnalysisReference: async () => ({ analysisId, version: 1, opportunityId, route: "purchase", analyzedAt: at }) },
    clock: { now: () => at },
  });
  return { dispatcher, opportunities, pipelines };
}
function trusted(requestFingerprint = "v1:11111111", commandId = "acquisition-command-123e4567-e89b-42d3-a456-426614174000"): TrustedAcquisitionCommandContext {
  return { commandId, requestFingerprint, actor, ownerId, requestedAt: at };
}

describe("Production acquisition application dispatcher", () => {
  it("executes once and replays the existing command receipt without duplicate activity", async () => {
    const { dispatcher, pipelines } = await fixture();
    const first = await dispatcher.execute(input, trusted());
    const replay = await dispatcher.execute(input, trusted());
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.commandId).toBe(first.commandId);
    expect((await pipelines.findByOpportunity(opportunityId))?.activity()).toHaveLength(1);
  });

  it("rejects one idempotency key reused with a different payload fingerprint", async () => {
    const { dispatcher } = await fixture();
    await dispatcher.execute(input, trusted());
    await expect(dispatcher.execute({ ...input, analysisVersion: 2 }, trusted("v1:22222222"))).rejects.toMatchObject({ code: "ACQUISITION_COMMAND_ID_REUSED" });
  });

  it("maps stale opportunity concurrency into a stable application conflict", async () => {
    const { dispatcher } = await fixture();
    await dispatcher.execute(input, trusted());
    const retryAsNewIntent = { ...input, envelope: { ...input.envelope, idempotencyKey: "223e4567-e89b-42d3-a456-426614174000" } };
    await expect(dispatcher.execute(retryAsNewIntent, trusted("v1:33333333", "acquisition-command-223e4567-e89b-42d3-a456-426614174000"))).rejects.toMatchObject({ code: "ACQUISITION_PIPELINE_ALREADY_EXISTS" });
  });
});
