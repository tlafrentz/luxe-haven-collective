import type { InvestmentLifecycleResult } from "@/features/investment-intelligence";
import { InvestmentOpportunity, OpportunityAnalysis, createInvestmentOpportunityId, createOpportunityAnalysisId, createOpportunityOwnerId, type InvestmentOpportunityId, type InvestmentOpportunityRoute, type OpportunityActorReference, type OpportunityAnalysisLineage, type OpportunityAnalysisPolicyVersions, type OpportunityAnalysisSnapshot, type OpportunityAnalysisSourceSummary, type OpportunityPropertyReference, type OpportunityStatus } from "../domain";
import { buildOpportunityAnalysisSnapshot } from "./snapshot-builder";
import { InvestmentOpportunityError } from "./errors";
import type { InvestmentOpportunityRepository, InvestmentOpportunityRepositoryQuery } from "./ports/repository";

export type OpportunityCommandContext = Readonly<{ authenticatedOwnerId: string; actor: OpportunityActorReference; occurredAt?: Date; commandId?: string; expectedVersion?: number }>;
export type SaveOpportunityAnalysisInput = Readonly<{ lifecycleResult: InvestmentLifecycleResult; lifecycleResultId: string; sourceSummary: OpportunityAnalysisSourceSummary; snapshot?: OpportunityAnalysisSnapshot; policyVersions?: Omit<OpportunityAnalysisPolicyVersions, "opportunitySnapshotSchema">; lineage?: Omit<OpportunityAnalysisLineage, "investmentLifecycleResultId" | "evidenceIds">; analyzedAt: Date }>;
const now = (context: OpportunityCommandContext) => context.occurredAt ?? new Date();
const mutation = (context: OpportunityCommandContext) => ({ actor: context.actor, occurredAt: now(context), ...(context.commandId ? { commandId: context.commandId } : {}) });
const defaultName = (property: OpportunityPropertyReference, route: InvestmentOpportunityRoute) => `${property.displayAddress} — ${route === "purchase" ? "Purchase" : "Rental Arbitrage"}`;

export async function createInvestmentOpportunity(repository: InvestmentOpportunityRepository, command: OpportunityCommandContext & { ownerId?: string; name?: string; route: InvestmentOpportunityRoute; property: OpportunityPropertyReference; initialAnalysis?: SaveOpportunityAnalysisInput; tags?: readonly string[] }) {
  if (command.ownerId && command.ownerId !== command.authenticatedOwnerId) throw new InvestmentOpportunityError("OPPORTUNITY_ACCESS_DENIED", "Authenticated ownership cannot be overridden.");
  const id = createInvestmentOpportunityId();
  const opportunity = InvestmentOpportunity.create({ id, ownerId: createOpportunityOwnerId(command.authenticatedOwnerId), name: command.name ?? defaultName(command.property, command.route), route: command.route, property: command.property, tags: command.tags, actor: command.actor, occurredAt: now(command), commandId: command.commandId });
  if (command.initialAnalysis) opportunity.addAnalysis(buildAnalysis(opportunity, command.initialAnalysis, command.actor), mutation(command));
  await repository.save(opportunity, undefined, command.commandId);
  return opportunity;
}

export async function saveOpportunityAnalysis(repository: InvestmentOpportunityRepository, command: OpportunityCommandContext & { opportunityId: InvestmentOpportunityId; analysis: SaveOpportunityAnalysisInput }) {
  const opportunity = await required(repository, command.opportunityId, command.authenticatedOwnerId);
  const expected = requireExpected(command, opportunity.version);
  opportunity.addAnalysis(buildAnalysis(opportunity, command.analysis, command.actor), mutation(command));
  await repository.save(opportunity, expected, command.commandId); return opportunity;
}
export async function updateOpportunityStatus(repository: InvestmentOpportunityRepository, command: OpportunityCommandContext & { opportunityId: InvestmentOpportunityId; status: OpportunityStatus }) { const opportunity = await required(repository, command.opportunityId, command.authenticatedOwnerId), expected = requireExpected(command, opportunity.version); opportunity.transitionStatus(command.status, mutation(command)); await repository.save(opportunity, expected, command.commandId); return opportunity; }
export async function updateInvestmentOpportunity(repository: InvestmentOpportunityRepository, command: OpportunityCommandContext & { opportunityId: InvestmentOpportunityId; name?: string; tags?: readonly string[] }) { const opportunity = await required(repository, command.opportunityId, command.authenticatedOwnerId), expected = requireExpected(command, opportunity.version); opportunity.updateMetadata({ ...mutation(command), name: command.name, tags: command.tags }); await repository.save(opportunity, expected, command.commandId); return opportunity; }
export async function archiveInvestmentOpportunity(repository: InvestmentOpportunityRepository, command: OpportunityCommandContext & { opportunityId: InvestmentOpportunityId }) { const opportunity = await required(repository, command.opportunityId, command.authenticatedOwnerId), expected = requireExpected(command, opportunity.version); opportunity.archive(mutation(command)); await repository.save(opportunity, expected, command.commandId); return opportunity; }
export async function restoreInvestmentOpportunity(repository: InvestmentOpportunityRepository, command: OpportunityCommandContext & { opportunityId: InvestmentOpportunityId }) { const opportunity = await required(repository, command.opportunityId, command.authenticatedOwnerId), expected = requireExpected(command, opportunity.version); opportunity.restoreArchive(mutation(command)); await repository.save(opportunity, expected, command.commandId); return opportunity; }
export const getInvestmentOpportunityById = (repository: InvestmentOpportunityRepository, id: InvestmentOpportunityId, ownerId: string) => repository.findById(id, createOpportunityOwnerId(ownerId));
export const listInvestmentOpportunities = (repository: InvestmentOpportunityRepository, filter: Omit<InvestmentOpportunityRepositoryQuery, "ownerId"> & { ownerId: string }) => repository.list({ ...filter, ownerId: createOpportunityOwnerId(filter.ownerId) });
export const listOpportunityAnalyses = (repository: InvestmentOpportunityRepository, opportunityId: InvestmentOpportunityId, ownerId: string) => repository.listAnalyses(opportunityId, createOpportunityOwnerId(ownerId));
export const getOpportunityAnalysisById = (repository: InvestmentOpportunityRepository, opportunityId: InvestmentOpportunityId, analysisId: Parameters<InvestmentOpportunityRepository["findAnalysisById"]>[1], ownerId: string) => repository.findAnalysisById(opportunityId, analysisId, createOpportunityOwnerId(ownerId));

function buildAnalysis(opportunity: InvestmentOpportunity, input: SaveOpportunityAnalysisInput, actor: OpportunityActorReference): OpportunityAnalysis {
  const result = input.lifecycleResult, evidenceIds = result.analysis.supportingEvidence.map(e => e.id), propertyId = result.analysis.property.id;
  return OpportunityAnalysis.create({ id: createOpportunityAnalysisId(), opportunityId: opportunity.id, sequence: opportunity.props.analyses.length + 1, route: result.acquisitionType, investmentAnalysisId: propertyId, resultSnapshot: input.snapshot ?? buildOpportunityAnalysisSnapshot(result, input.analyzedAt), sourceSummary: input.sourceSummary, policyVersions: { ...input.policyVersions, opportunitySnapshotSchema: "1" }, lineage: { ...input.lineage, investmentLifecycleResultId: input.lifecycleResultId, evidenceIds }, createdBy: actor, createdAt: new Date(input.analyzedAt) });
}
async function required(repository: InvestmentOpportunityRepository, id: InvestmentOpportunityId, owner: string) { const value = await repository.findById(id, createOpportunityOwnerId(owner)); if (!value) throw new InvestmentOpportunityError("OPPORTUNITY_NOT_FOUND", "Investment opportunity was not found."); return value; }
function requireExpected(context: OpportunityCommandContext, actual: number) { if (context.expectedVersion === undefined) throw new InvestmentOpportunityError("CONCURRENT_OPPORTUNITY_MODIFICATION", "An expected aggregate version is required."); if (context.expectedVersion !== actual) throw new InvestmentOpportunityError("CONCURRENT_OPPORTUNITY_MODIFICATION", "The opportunity was modified concurrently."); return context.expectedVersion; }
