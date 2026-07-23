import { Result, type ResultType } from "@/platform/kernel";
import type {
  AcquisitionUnavailableWorkspace,
  AcquisitionWorkspace,
  AcquisitionWorkspaceActionReader,
  AcquisitionWorkspaceActionState,
  AcquisitionWorkspaceAnalysisReader,
  AcquisitionWorkspaceAuthorizer,
  AcquisitionWorkspaceDeploymentStatus,
  AcquisitionWorkspaceEvidenceReader,
  AcquisitionWorkspaceEvidenceState,
  AcquisitionWorkspaceOpportunityReader,
  AcquisitionWorkspaceOpportunitySource,
  AcquisitionWorkspacePipelineReader,
  AcquisitionWorkspaceQueryObserver,
  AcquisitionWorkspaceQueryError,
  GetAcquisitionWorkspaceQuery,
} from "./contracts";
import { buildAcquisitionCapabilities, buildAcquisitionWorkspace, buildAnalysisWorkspaceSummary, buildInfrastructureLimitations, buildOpportunityWorkspaceSummary, deepFreeze, resolveAcquisitionWorkspaceLimits } from "./projections";

export type GetAcquisitionWorkspaceDependencies = Readonly<{
  opportunities: AcquisitionWorkspaceOpportunityReader;
  analyses: AcquisitionWorkspaceAnalysisReader;
  pipelines: AcquisitionWorkspacePipelineReader;
  actions: AcquisitionWorkspaceActionReader;
  evidence: AcquisitionWorkspaceEvidenceReader;
  authorization: AcquisitionWorkspaceAuthorizer;
  deployment: AcquisitionWorkspaceDeploymentStatus;
  now: () => Date;
  observer?: AcquisitionWorkspaceQueryObserver;
}>;

export async function getAcquisitionWorkspace(query: GetAcquisitionWorkspaceQuery, dependencies: GetAcquisitionWorkspaceDependencies): Promise<ResultType<AcquisitionWorkspace, AcquisitionWorkspaceQueryError>> {
  const observer = dependencies.observer ?? passThroughObserver;
  const limits = resolveAcquisitionWorkspaceLimits(query);
  if (!limits || !query.ownerId.trim() || !query.opportunityId?.value || !query.actor?.id?.trim()) return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_INPUT_INVALID" }));
  let authorization;
  try { authorization = await observer.measure("authorization", () => dependencies.authorization.authorize({ ownerId: query.ownerId, actor: query.actor, opportunityId: query.opportunityId })); }
  catch { return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_UNEXPECTED" })); }
  if (!authorization.authenticated) return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_NOT_AUTHENTICATED" }));
  if (!authorization.canRead) return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_NOT_AUTHORIZED" }));
  let opportunity;
  try { opportunity = await observer.measure("opportunity-reader", () => dependencies.opportunities.findOpportunity({ ownerId: query.ownerId, opportunityId: query.opportunityId })); }
  catch { return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_OPPORTUNITY_UNAVAILABLE", retryable: true })); }
  if (!opportunity || opportunity.ownerId !== query.ownerId) return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_NOT_FOUND" }));
  const evaluatedAt = dependencies.now();
  if (!(evaluatedAt instanceof Date) || Number.isNaN(evaluatedAt.getTime())) return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_UNEXPECTED" }));
  const [analysisResult, pipelineResult] = await Promise.allSettled([
    observer.measure("analysis-reader", () => dependencies.analyses.findLatestCompletedAnalysis({ ownerId: query.ownerId, opportunityId: query.opportunityId })),
    observer.measure("pipeline-reader", () => dependencies.pipelines.findByOpportunity({ ownerId: query.ownerId, opportunityId: query.opportunityId, evaluatedAt })),
  ]);
  let analysis = analysisResult.status === "fulfilled" ? analysisResult.value : null;
  if (analysis && (!analysis.opportunityId.equals(opportunity.id) || analysis.route !== opportunity.route || !analysis.complete || !Number.isInteger(analysis.version) || analysis.version < 1)) analysis = null;
  if (pipelineResult.status === "rejected") return Result.ok(buildUnavailable(opportunity, analysis, authorization, dependencies.deployment, evaluatedAt));
  const pipeline = pipelineResult.value;
  let actionStates: readonly AcquisitionWorkspaceActionState[] = [], evidenceStates: readonly AcquisitionWorkspaceEvidenceState[] = [];
  let actionDependencyAvailable = true, evidenceDependencyAvailable = true;
  if (pipeline) {
    const actionIds = unique([...pipeline.contingencies, ...pipeline.dueDiligenceItems].flatMap(value => value.actionReferences.map(reference => reference.actionId.value))).slice(0, 25);
    const evidenceIds = unique([...pipeline.contingencies, ...pipeline.dueDiligenceItems].flatMap(value => value.evidenceReferences.map(reference => reference.evidenceId.value))).slice(0, 25);
    const [actions, evidence] = await Promise.allSettled([
      actionIds.length ? observer.measure("action-reader", () => dependencies.actions.getActionStates({ ownerId: query.ownerId, actionIds })) : Promise.resolve([]),
      evidenceIds.length ? observer.measure("evidence-reader", () => dependencies.evidence.getEvidenceStates({ ownerId: query.ownerId, evidenceIds })) : Promise.resolve([]),
    ]);
    if (actions.status === "fulfilled") actionStates = actions.value; else actionDependencyAvailable = false;
    if (evidence.status === "fulfilled") evidenceStates = evidence.value; else evidenceDependencyAvailable = false;
  }
  try { return Result.ok(observer.measureSync("projection", () => buildAcquisitionWorkspace({ opportunity, analysis, pipeline, actionStates, evidenceStates, authorization, deployment: dependencies.deployment, evaluatedAt, limits, actionDependencyAvailable, evidenceDependencyAvailable }))); }
  catch { return Result.fail(Object.freeze({ code: "ACQUISITION_WORKSPACE_PIPELINE_INVALID", retryable: false })); }
}

function buildUnavailable(opportunity: AcquisitionWorkspaceOpportunitySource, analysisSource: Awaited<ReturnType<AcquisitionWorkspaceAnalysisReader["findLatestCompletedAnalysis"]>>, authorization: Awaited<ReturnType<AcquisitionWorkspaceAuthorizer["authorize"]>>, deployment: AcquisitionWorkspaceDeploymentStatus, evaluatedAt: Date): AcquisitionUnavailableWorkspace {
  const analysis = buildAnalysisWorkspaceSummary(analysisSource, opportunity, evaluatedAt);
  const limitations = buildInfrastructureLimitations(deployment, false, false);
  const capabilities = buildAcquisitionCapabilities({ authorization, deployment, opportunity, analysis, pipeline: null, actionDependencyAvailable: false, evidenceDependencyAvailable: false });
  return deepFreeze({ status: "acquisition-unavailable", opportunity: buildOpportunityWorkspaceSummary(opportunity), analysis, reason: { code: "PIPELINE_UNAVAILABLE", retryable: true, message: "Acquisition state could not be loaded." }, capabilities, versions: { opportunityVersion: opportunity.version, ...(analysis ? { latestAnalysisVersion: analysis.version } : {}) }, limitations });
}
function unique(values: readonly string[]): readonly string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
const passThroughObserver: AcquisitionWorkspaceQueryObserver = Object.freeze({
  measure: async <T>(_operation: import("./contracts").AcquisitionWorkspaceQueryOperation, work: () => Promise<T>) => work(),
  measureSync: <T>(_operation: import("./contracts").AcquisitionWorkspaceQueryOperation, work: () => T) => work(),
});
