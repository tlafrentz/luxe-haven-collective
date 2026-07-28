import {
  createInvestmentOpportunityId,
  createOpportunityAnalysisId,
  createOpportunityOwnerId,
  type InvestmentOpportunity,
  type OpportunityAnalysis,
  type OpportunityAnalysisSnapshot,
} from "../domain";
import type { InvestmentOpportunityRepository } from "./ports/repository";

export const IMMUTABLE_ANALYSIS_PROJECTION_VERSION = "investment-analysis-projection.v1" as const;

export type ImmutableAnalysisProjection = Readonly<{
  projectionVersion: typeof IMMUTABLE_ANALYSIS_PROJECTION_VERSION;
  opportunity: Readonly<{
    id: string;
    name: string;
    status: string;
    tags: readonly string[];
    archived: boolean;
    route: string;
    property: InvestmentOpportunity["props"]["property"];
    aggregateVersion: number;
  }>;
  analysisVersion: Readonly<{
    id: string;
    number: number;
    createdAt: Date;
    author: OpportunityAnalysis["props"]["createdBy"];
    policyVersions: OpportunityAnalysis["props"]["policyVersions"];
    lineage: OpportunityAnalysis["props"]["lineage"];
    sourceSummary: OpportunityAnalysis["props"]["sourceSummary"];
  }>;
  snapshot: OpportunityAnalysisSnapshot;
  assumptions: NonNullable<OpportunityAnalysisSnapshot["assumptions"]>;
}>;

export async function readImmutableAnalysis(
  repository: InvestmentOpportunityRepository,
  input: Readonly<{ ownerId: string; opportunityId: string; analysisVersionId?: string }>,
): Promise<ImmutableAnalysisProjection | null> {
  const opportunity = await repository.findById(
    createInvestmentOpportunityId(input.opportunityId),
    createOpportunityOwnerId(input.ownerId),
  );
  if (!opportunity) return null;
  const analysis = input.analysisVersionId
    ? opportunity.props.analyses.find(item => item.id.value === createOpportunityAnalysisId(input.analysisVersionId).value)
    : resolveCanonicalLatestVersion(opportunity);
  if (!analysis) return null;
  const props = opportunity.props;
  const version = analysis.props;
  const projection = {
    projectionVersion: IMMUTABLE_ANALYSIS_PROJECTION_VERSION,
    opportunity: {
      id: props.id.value,
      name: props.name.value,
      status: props.status,
      tags: props.tags.map(tag => tag.displayValue),
      archived: Boolean(props.archivedAt),
      route: props.route,
      property: props.property,
      aggregateVersion: props.version,
    },
    analysisVersion: {
      id: version.id.value,
      number: version.sequence,
      createdAt: version.createdAt,
      author: version.createdBy,
      policyVersions: version.policyVersions,
      lineage: version.lineage,
      sourceSummary: version.sourceSummary,
    },
    snapshot: version.resultSnapshot,
    assumptions: version.resultSnapshot.assumptions ?? [],
  } satisfies ImmutableAnalysisProjection;
  console.info("immutable_analysis_projection_read", {
    workspaceId: input.ownerId,
    opportunityId: input.opportunityId,
    analysisVersionId: version.id.value,
    projectionVersion: IMMUTABLE_ANALYSIS_PROJECTION_VERSION,
  });
  return deepFreeze(structuredClone(projection));
}

export function resolveCanonicalLatestVersion(opportunity: InvestmentOpportunity): OpportunityAnalysis | undefined {
  return [...opportunity.props.analyses].sort((left, right) =>
    right.sequence - left.sequence || right.id.value.localeCompare(left.id.value),
  )[0];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
