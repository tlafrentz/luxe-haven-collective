import type { AcquisitionServerCommandResult } from "./contracts";

type CodedError = Readonly<{ code?: unknown }>;
export function mapAcquisitionServerCommandError(error: unknown, correlationId: string): AcquisitionServerCommandResult {
  const code = typeof error === "object" && error !== null ? (error as CodedError).code : undefined;
  if (code === "ACQUISITION_PIPELINE_NOT_FOUND" || code === "ACQUISITION_OPPORTUNITY_NOT_FOUND" || code === "ACQUISITION_ANALYSIS_NOT_FOUND") {
    return { status: "not-found", code: "ACQUISITION_COMMAND_TARGET_NOT_FOUND" };
  }
  if (code === "ACQUISITION_NOT_AUTHORIZED") return { status: "not-authorized", code: "ACQUISITION_COMMAND_NOT_AUTHORIZED" };
  if (code === "ACQUISITION_PIPELINE_VERSION_CONFLICT" || code === "ACQUISITION_OPPORTUNITY_VERSION_CONFLICT") {
    return { status: "conflict", code: "ACQUISITION_COMMAND_VERSION_CONFLICT", reloadRequired: true };
  }
  if (code === "ACQUISITION_COMMAND_ID_REUSED") {
    return { status: "conflict", code: "ACQUISITION_COMMAND_IDEMPOTENCY_CONFLICT", reloadRequired: false };
  }
  if (code === "ACQUISITION_DEPENDENCY_UNAVAILABLE" || code === "ACQUISITION_TRANSACTION_FAILED" || code === "ACQUISITION_EVENT_PUBLICATION_FAILED") {
    return { status: "unavailable", code: "ACQUISITION_COMMAND_DEPENDENCY_UNAVAILABLE", retryable: true };
  }
  if (code === "ACQUISITION_PIPELINE_ALREADY_EXISTS" || code === "ACQUISITION_APPLICATION_INPUT_INVALID") {
    return {
      status: "blocked",
      code: String(code),
      blockers: [{ code: String(code), source: code === "ACQUISITION_PIPELINE_ALREADY_EXISTS" ? "pipeline" : "pipeline", message: code === "ACQUISITION_PIPELINE_ALREADY_EXISTS" ? "An acquisition pursuit already exists for this opportunity." : "The acquisition cannot perform this action in its current state.", resolvable: true }],
    };
  }
  return { status: "failed", code: "ACQUISITION_COMMAND_FAILED", correlationId };
}
