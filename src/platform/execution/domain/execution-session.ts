import { ExecutionStatus } from "./execution-status";
import { ExecutionProgress } from "./execution-progress";
import { ExecutionStatistics } from "./execution-statistics";
import { ExecutionDiagnostics } from "./execution-diagnostics";

export interface ExecutionSession {
  readonly status: ExecutionStatus;
  readonly progress: ExecutionProgress;
  readonly statistics: ExecutionStatistics;
  readonly diagnostics: ExecutionDiagnostics;
}
