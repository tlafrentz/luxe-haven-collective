export interface ExecutionDiagnostics {
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly skippedItems: readonly string[];
  readonly exceptions: readonly string[];
}
