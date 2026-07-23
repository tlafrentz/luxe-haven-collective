import type {
  AcquisitionWorkspaceQueryObserver,
  AcquisitionWorkspaceQueryOperation,
} from "../application";

export type AcquisitionWorkspaceQueryLogFields = Readonly<{
  opportunityId: string;
  ownerId: string;
  pipelineId?: string;
  durationMs: number;
  degradedDependencies: readonly string[];
  resultState: string;
}>;

export interface AcquisitionWorkspaceQueryLogger {
  info(event: "acquisition_workspace_query_completed", fields: AcquisitionWorkspaceQueryLogFields): void;
}

export interface AcquisitionWorkspaceQueryMetrics {
  observeDuration(operation: AcquisitionWorkspaceQueryOperation | "total", durationMs: number, outcome: "success" | "failure"): void;
}

export class ProductionAcquisitionWorkspaceQueryObserver implements AcquisitionWorkspaceQueryObserver {
  public constructor(
    private readonly metrics: AcquisitionWorkspaceQueryMetrics,
    private readonly monotonicNow: () => number,
  ) {}

  public async measure<T>(operation: AcquisitionWorkspaceQueryOperation, work: () => Promise<T>): Promise<T> {
    const started = this.monotonicNow();
    try {
      const value = await work();
      this.metrics.observeDuration(operation, elapsed(this.monotonicNow(), started), "success");
      return value;
    } catch (error) {
      this.metrics.observeDuration(operation, elapsed(this.monotonicNow(), started), "failure");
      throw error;
    }
  }

  public measureSync<T>(operation: AcquisitionWorkspaceQueryOperation, work: () => T): T {
    const started = this.monotonicNow();
    try {
      const value = work();
      this.metrics.observeDuration(operation, elapsed(this.monotonicNow(), started), "success");
      return value;
    } catch (error) {
      this.metrics.observeDuration(operation, elapsed(this.monotonicNow(), started), "failure");
      throw error;
    }
  }
}

export function elapsed(finished: number, started: number): number {
  return Math.max(0, finished - started);
}
