import { Result, type ResultType } from "@/platform/kernel";
import type { ContinuousImprovementWorkspaceState, GetContinuousImprovementWorkspaceError } from "../workspace";
import { buildLearningIntelligenceDashboard } from "./build-learning-intelligence-dashboard";
import type { GetLearningDashboardError, GetLearningDashboardQuery, LearningIntelligenceDashboardState } from "./learning-intelligence-dashboard";

type WorkspaceQuery = (query: GetLearningDashboardQuery) => Promise<ResultType<ContinuousImprovementWorkspaceState, GetContinuousImprovementWorkspaceError>>;

export function createGetLearningDashboard(getWorkspace: WorkspaceQuery) {
  return async (query: GetLearningDashboardQuery): Promise<ResultType<LearningIntelligenceDashboardState, GetLearningDashboardError>> => {
    const result = await getWorkspace(query);
    if (result.isFailure) return Result.fail(mapError(result.error));
    return Result.ok(buildLearningIntelligenceDashboard(result.value));
  };
}
function mapError(error: GetContinuousImprovementWorkspaceError): GetLearningDashboardError {
  if (error.code === "LEARNING_WORKSPACE_NOT_AUTHENTICATED") return { code: "LEARNING_DASHBOARD_NOT_AUTHENTICATED" };
  if (error.code === "LEARNING_WORKSPACE_NOT_FOUND") return { code: "LEARNING_DASHBOARD_NOT_FOUND" };
  if (error.code === "LEARNING_WORKSPACE_NOT_AUTHORIZED") return { code: "LEARNING_DASHBOARD_NOT_AUTHORIZED" };
  if (error.code === "LEARNING_WORKSPACE_INPUT_INVALID") return { code: "LEARNING_DASHBOARD_INPUT_INVALID", ...(error.field ? { field: error.field } : {}) };
  return { code: "LEARNING_DASHBOARD_UNEXPECTED", ...("correlationId" in error && error.correlationId ? { correlationId: error.correlationId } : {}) };
}
