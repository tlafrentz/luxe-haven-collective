import type { ResultType } from "@/platform/kernel";
import {
  getAcquisitionWorkspace,
  type AcquisitionWorkspace,
  type AcquisitionWorkspaceQueryError,
  type GetAcquisitionWorkspaceDependencies,
  type GetAcquisitionWorkspaceQuery,
} from "../application";
import {
  elapsed,
  type AcquisitionWorkspaceQueryLogger,
  type AcquisitionWorkspaceQueryMetrics,
} from "./production-observability";

export class GetAcquisitionWorkspaceHandler {
  public constructor(
    private readonly dependencies: GetAcquisitionWorkspaceDependencies,
    private readonly logger: AcquisitionWorkspaceQueryLogger,
    private readonly metrics: AcquisitionWorkspaceQueryMetrics,
    private readonly monotonicNow: () => number,
  ) {}

  public async execute(query: GetAcquisitionWorkspaceQuery): Promise<ResultType<AcquisitionWorkspace, AcquisitionWorkspaceQueryError>> {
    const started = this.monotonicNow();
    const result = await getAcquisitionWorkspace(query, this.dependencies);
    const durationMs = elapsed(this.monotonicNow(), started);
    this.metrics.observeDuration("total", durationMs, result.isSuccess ? "success" : "failure");
    const value = result.isSuccess ? result.value : undefined;
    const pipelineId = value?.status === "pipeline-active" || value?.status === "pipeline-terminal"
      ? value.acquisition.pipelineId
      : undefined;
    this.logger.info("acquisition_workspace_query_completed", Object.freeze({
      opportunityId: query.opportunityId.value,
      ownerId: query.ownerId,
      ...(pipelineId ? { pipelineId } : {}),
      durationMs,
      degradedDependencies: Object.freeze(value?.limitations.map((limitation) => limitation.code) ?? []),
      resultState: result.isSuccess ? result.value.status : result.error.code,
    }));
    return result;
  }
}
