export const ACQUISITION_SERVER_COMMAND_TYPES = [
  "activate-pipeline",
  "transition-stage",
  "exit-pipeline",
  "begin-closing-preparation",
  "close-acquisition",
  "create-offer-draft",
  "submit-offer",
  "record-contract",
  "update-offer-draft",
  "record-counterparty-response",
  "initialize-requirements",
  "update-requirement",
  "link-action-reference",
  "link-evidence-reference",
  "link-document-reference",
] as const;
export type AcquisitionServerCommandType = (typeof ACQUISITION_SERVER_COMMAND_TYPES)[number];
export type AcquisitionServerCommandRollout = "enabled" | "read-model-only" | "not-deployed" | "not-remotely-verified" | "dependency-unavailable";

export type AcquisitionServerCommandEnvelope = Readonly<{
  opportunityId: string;
  pipelineId?: string;
  expectedOpportunityVersion: number;
  expectedPipelineVersion?: number;
  idempotencyKey: string;
}>;
export type AcquisitionMoneyInput = Readonly<{ amount: string; currency: "USD" }>;
export type AcquisitionSourceAnalysisInput = Readonly<{ analysisId: string; version: number; analyzedAt: string; route: "purchase" | "rental-arbitrage"; assumptionFingerprint?: string }>;
export type AcquisitionPurchaseOfferInput = Readonly<{
  commandType: "create-offer-draft";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
  route: "purchase";
  sourceAnalysis: AcquisitionSourceAnalysisInput;
  terms: Readonly<{
    offerPrice: AcquisitionMoneyInput;
    earnestMoney?: AcquisitionMoneyInput;
    financing: Readonly<{ type: "cash" } | { type: "financed"; financingContingency: boolean; downPayment?: AcquisitionMoneyInput; downPaymentPercentage?: number }>;
    requestedSellerConcessions?: AcquisitionMoneyInput;
    proposedClosingDate?: string;
    expiration?: string;
    conditions: readonly Readonly<{ type: "inspection" | "financing" | "appraisal" | "title-review" | "hoa-review" | "insurance" | "seller-disclosure" | "other"; explanation?: string }>[];
  }>;
}>;
export type AcquisitionRentalOfferInput = Readonly<{
  commandType: "create-offer-draft";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
  route: "rental-arbitrage";
  sourceAnalysis: AcquisitionSourceAnalysisInput;
  terms: Readonly<{
    proposedMonthlyRent: AcquisitionMoneyInput;
    securityDeposit?: AcquisitionMoneyInput;
    leaseTermMonths: number;
    proposedCommencementDate?: string;
    expiration?: string;
    operatingPermission: Readonly<{ required: true; requestedForm: "lease-clause" | "written-addendum" | "separate-authorization" } | { required: false; reason: string }>;
    utilityResponsibilities: readonly Readonly<{ utility: "electricity" | "gas" | "water" | "sewer" | "trash" | "internet" | "other"; party: "operator" | "landlord" | "shared"; explanation?: string }>[];
    requestedConcessions: readonly Readonly<{ description: string; amount?: AcquisitionMoneyInput }>[];
    conditions: readonly Readonly<{ type: "landlord-authorization" | "regulatory-eligibility" | "utilities" | "other"; explanation?: string }>[];
  }>;
}>;
export type CreateAcquisitionOfferServerInput = AcquisitionPurchaseOfferInput | AcquisitionRentalOfferInput;

export type ActivateAcquisitionPipelineServerInput = Readonly<{
  commandType: "activate-pipeline";
  envelope: AcquisitionServerCommandEnvelope;
  analysisId: string;
  analysisVersion: number;
  route: "purchase" | "rental-arbitrage";
}>;
export type TransitionAcquisitionStageServerInput = Readonly<{
  commandType: "transition-stage";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
  targetStage: "pursuit" | "offer-preparation" | "due-diligence";
  reason?: Readonly<{ code: "offer-revised" | "counteroffer-received" | "agreement-amended" | "due-diligence-reopened" | "closing-condition-unresolved" | "operator-correction" | "other"; explanation?: string }>;
}>;
export type SubmitAcquisitionOfferServerInput = Readonly<{
  commandType: "submit-offer";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
  offerId: string;
}>;
export type ExitAcquisitionPipelineServerInput = Readonly<{
  commandType: "exit-pipeline";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
  reason: "offer-rejected" | "terms-unacceptable" | "inspection-failed" | "financing-failed" | "appraisal-failed" | "title-or-legal" | "regulatory-ineligible" | "landlord-declined" | "economics-deteriorated" | "operator-withdrew" | "counterparty-withdrew" | "opportunity-unavailable" | "other";
  explanation?: string;
  exitedFromStage: "pursuit" | "offer-preparation" | "offer-submitted" | "negotiating" | "under-contract" | "due-diligence" | "closing-preparation";
  reconsideration: Readonly<{ eligible: false } | { eligible: true; notBefore?: string; note?: string }>;
}>;
export type BeginClosingPreparationServerInput = Readonly<{
  commandType: "begin-closing-preparation";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
}>;
export type CloseAcquisitionServerInput = Readonly<{
  commandType: "close-acquisition";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
  closingFacts: Readonly<
    | { route: "purchase"; closedAt: string; finalPurchasePrice: AcquisitionMoneyInput; financingType: "cash" | "financed" }
    | { route: "rental-arbitrage"; agreementExecutedAt: string; commencementAt: string; finalMonthlyRent: AcquisitionMoneyInput; operatingPermissionStatus: "explicitly-authorized" | "unclear" | "not-authorized" }
  >;
}>;
export type RecordAcquisitionContractServerInput = Readonly<{
  commandType: "record-contract";
  envelope: AcquisitionServerCommandEnvelope & Readonly<{ pipelineId: string; expectedPipelineVersion: number }>;
  source: Readonly<
    | { type: "accepted-offer"; offerId: string }
    | { type: "accepted-counteroffer"; offerId: string; responseId: string }
    | { type: "external-agreement"; externalReference?: string; explanation: string }
  >;
  terms: Readonly<
    | { route: "purchase"; contractPrice: AcquisitionMoneyInput; financing: Readonly<{ type: "cash" } | { type: "financed"; financingContingency: boolean; plannedDownPayment?: AcquisitionMoneyInput }>; effectiveDate: string; scheduledClosingDate: string }
    | { route: "rental-arbitrage"; contractedMonthlyRent: AcquisitionMoneyInput; leaseTermMonths: number; effectiveDate: string; commencementDate: string; operatingPermission: Readonly<{ status: "explicitly-authorized"; form: "lease-clause" | "written-addendum" | "separate-authorization" } | { status: "not-authorized" } | { status: "unclear"; explanation: string }> }
  >;
}>;

export type AcquisitionImplementedServerCommandInput =
  | ActivateAcquisitionPipelineServerInput
  | TransitionAcquisitionStageServerInput
  | ExitAcquisitionPipelineServerInput
  | BeginClosingPreparationServerInput
  | CloseAcquisitionServerInput
  | CreateAcquisitionOfferServerInput
  | SubmitAcquisitionOfferServerInput
  | RecordAcquisitionContractServerInput;

export type AcquisitionCommandSuccessData = Readonly<{
  opportunityId: string;
  pipelineId?: string;
  opportunityVersion: number;
  pipelineVersion?: number;
  workspaceState: "opportunity-only" | "pipeline-active" | "pipeline-terminal";
  stage?: string;
  redirectHref?: string;
}>;
export type AcquisitionCommandReceiptSummary = Readonly<{ commandId: string; idempotencyKey: string; outcome: "executed" | "replayed" }>;
export type AcquisitionCommandRevalidationSummary = Readonly<{ paths: readonly string[] }>;
export type AcquisitionServerCommandBlocker = Readonly<{ code: string; source: "opportunity" | "pipeline" | "analysis" | "offer" | "contract" | "requirement" | "readiness" | "action" | "evidence" | "deployment"; sourceId?: string; message: string; resolvable: boolean }>;
export type AcquisitionServerCommandResult<TSuccess = AcquisitionCommandSuccessData> =
  | Readonly<{ status: "succeeded"; data: TSuccess; receipt: AcquisitionCommandReceiptSummary; revalidation: AcquisitionCommandRevalidationSummary }>
  | Readonly<{ status: "validation-error"; code: "ACQUISITION_COMMAND_INPUT_INVALID"; fieldErrors: Readonly<Record<string, readonly string[]>>; formErrors: readonly string[] }>
  | Readonly<{ status: "not-authenticated"; code: "ACQUISITION_COMMAND_NOT_AUTHENTICATED" }>
  | Readonly<{ status: "not-found"; code: "ACQUISITION_COMMAND_TARGET_NOT_FOUND" }>
  | Readonly<{ status: "not-authorized"; code: "ACQUISITION_COMMAND_NOT_AUTHORIZED" }>
  | Readonly<{ status: "conflict"; code: "ACQUISITION_COMMAND_VERSION_CONFLICT" | "ACQUISITION_COMMAND_IDEMPOTENCY_CONFLICT"; reloadRequired: boolean }>
  | Readonly<{ status: "blocked"; code: string; blockers: readonly AcquisitionServerCommandBlocker[] }>
  | Readonly<{ status: "unavailable"; code: "ACQUISITION_COMMAND_NOT_DEPLOYED" | "ACQUISITION_COMMAND_NOT_VERIFIED" | "ACQUISITION_COMMAND_DEPENDENCY_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ status: "failed"; code: "ACQUISITION_COMMAND_FAILED"; correlationId?: string }>;
