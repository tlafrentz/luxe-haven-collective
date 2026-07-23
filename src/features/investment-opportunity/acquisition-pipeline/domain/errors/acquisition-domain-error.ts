export const ACQUISITION_ERROR_CODES = [
  "INVALID_ACQUISITION_PIPELINE_ID",
  "INVALID_ACQUISITION_TRANSITION_ID",
  "INVALID_ACQUISITION_COMMAND_ID",
  "INVALID_ACQUISITION_STAGE",
  "INVALID_ACQUISITION_STAGE_TRANSITION",
  "ACQUISITION_TRANSITION_REASON_REQUIRED",
  "ACQUISITION_TRANSITION_EXPLANATION_REQUIRED",
  "ACQUISITION_PIPELINE_TERMINAL",
  "UNSUPPORTED_ACQUISITION_ROUTE",
  "ACQUISITION_ROUTE_MISMATCH",
  "INVALID_PIPELINE_ACTIVATION",
  "INVALID_PIPELINE_SOURCE_ANALYSIS",
  "INVALID_ACQUISITION_ACTOR",
  "INVALID_ACQUISITION_PIPELINE_VERSION",
  "INVALID_ACQUISITION_COMMAND_CONTEXT",
  "INVALID_ACQUISITION_EXIT_REASON",
  "ACQUISITION_EXIT_REASON_NOT_APPLICABLE",
  "ACQUISITION_EXIT_EXPLANATION_REQUIRED",
  "INVALID_ACQUISITION_EXIT",
] as const;

export type AcquisitionErrorCode = (typeof ACQUISITION_ERROR_CODES)[number];

export class AcquisitionDomainError extends Error {
  public readonly code: AcquisitionErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(code: AcquisitionErrorCode, details?: Readonly<Record<string, unknown>>) {
    super(code);
    this.name = "AcquisitionDomainError";
    this.code = code;
    this.details = details;
    Object.freeze(this);
  }
}
