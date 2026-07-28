import type { ImmutableAnalysisProjection } from "./immutable-analysis-projection";

export type DownstreamArtifactReference =
  | Readonly<{kind:"scenario";id:string;opportunityId:string;analysisVersionId:string;createdAt:string}>
  | Readonly<{kind:"report";id:string;opportunityId:string;analysisVersionId:string;createdAt:string}>
  | Readonly<{kind:"activity";id:string;opportunityId:string;analysisVersionId:string;createdAt:string}>;

export type InvestmentDecisionLineageGraph = Readonly<{
  opportunityId:string;
  analysisVersionId:string;
  recommendation:ImmutableAnalysisProjection["snapshot"]["recommendation"];
  evidence:ImmutableAnalysisProjection["snapshot"]["evidence"];
  artifacts:readonly Readonly<DownstreamArtifactReference & {
    sourceAnalysisPath:string;
    opportunityPath:string;
  }>[];
}>;

export function buildInvestmentDecisionLineageGraph(
  projection:ImmutableAnalysisProjection,
  artifacts:readonly DownstreamArtifactReference[],
):InvestmentDecisionLineageGraph {
  for(const artifact of artifacts) {
    if(artifact.opportunityId!==projection.opportunity.id||artifact.analysisVersionId!==projection.analysisVersion.id) {
      throw new Error("DOWNSTREAM_LINEAGE_MISMATCH");
    }
  }
  return deepFreeze({
    opportunityId:projection.opportunity.id,
    analysisVersionId:projection.analysisVersion.id,
    recommendation:structuredClone(projection.snapshot.recommendation),
    evidence:structuredClone(projection.snapshot.evidence),
    artifacts:artifacts.map(artifact=>({
      ...artifact,
      sourceAnalysisPath:`/dashboard/investments/opportunities/${artifact.opportunityId}/analyses/${artifact.analysisVersionId}`,
      opportunityPath:`/dashboard/investments/opportunities/${artifact.opportunityId}`,
    })),
  });
}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}
