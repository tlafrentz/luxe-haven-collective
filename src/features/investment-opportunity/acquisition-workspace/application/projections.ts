import {
  ACQUISITION_STAGES,
  getAcquisitionStageDefinition,
  getAllowedAcquisitionStageTransitions,
  isTerminalAcquisitionStage,
  type AcquisitionActivity,
  type AcquisitionClosingFacts,
  type AcquisitionClosingReadiness,
  type AcquisitionContract,
  type AcquisitionOffer,
  type AcquisitionOfferTerms,
  type AcquisitionStage,
} from "../../acquisition-pipeline/domain";
import type {
  AcquisitionAcceptedAgreementWorkspaceSummary,
  AcquisitionActivationBlockerCode,
  AcquisitionActivationSummary,
  AcquisitionActiveWorkspace,
  AcquisitionCapabilityAvailability,
  AcquisitionCapabilityLimitation,
  AcquisitionClosingFactsWorkspaceSummary,
  AcquisitionClosingReadinessWorkspaceSummary,
  AcquisitionCommercialWorkspaceSummary,
  AcquisitionContractHeadlineTerms,
  AcquisitionContractWorkspaceSummary,
  AcquisitionLifecycleWorkspaceSummary,
  AcquisitionOfferHeadlineTerms,
  AcquisitionOfferWorkspaceSummary,
  AcquisitionPipelineTerminalWorkspaceSummary,
  AcquisitionPipelineWorkspaceSummary,
  AcquisitionRequirementConcernSummary,
  AcquisitionRequirementsWorkspaceSummary,
  AcquisitionRequirementWorkspaceItem,
  AcquisitionTerminalOutcomeSummary,
  AcquisitionTerminalWorkspace,
  AcquisitionWorkspace,
  AcquisitionWorkspaceActionState,
  AcquisitionWorkspaceAnalysisSource,
  AcquisitionWorkspaceAuthorizationSource,
  AcquisitionWorkspaceCapabilities,
  AcquisitionWorkspaceDeploymentStatus,
  AcquisitionWorkspaceEvidenceState,
  AcquisitionWorkspaceHealth,
  AcquisitionWorkspaceNextAction,
  AcquisitionWorkspaceOpportunitySource,
  AcquisitionWorkspacePipelineSource,
  AcquisitionWorkspaceResolvedLimits,
  AcquisitionWorkspaceVersions,
  InvestmentAnalysisWorkspaceSummary,
  InvestmentOpportunityWorkspaceSummary,
} from "./contracts";
import { ACQUISITION_WORKSPACE_LIMITS } from "./contracts";

// The unused-looking alias imports above are intentionally avoided at runtime; keep this
// module dependent only on public domain policy and application source contracts.

const stageLabels: Readonly<Record<AcquisitionStage, string>> = Object.freeze({
  pursuit: "Pursuit",
  "offer-preparation": "Offer preparation",
  "offer-submitted": "Offer submitted",
  negotiating: "Negotiating",
  "under-contract": "Under contract",
  "due-diligence": "Due diligence",
  "closing-preparation": "Closing preparation",
  "closed-acquired": "Acquired",
  exited: "Exited",
});
const priorityRank = { critical: 0, high: 1, normal: 2, low: 3 } as const;
const severityRank = { critical: 0, high: 1, moderate: 2, low: 3 } as const;
const resolved = new Set(["satisfied", "waived", "failed", "not-applicable"]);

export function resolveAcquisitionWorkspaceLimits(input: Readonly<{ activityLimit?: number; historyLimit?: number; offerHistoryLimit?: number; requirementsLimit?: number }>): AcquisitionWorkspaceResolvedLimits | null {
  const values = [
    ["activity", input.activityLimit, ACQUISITION_WORKSPACE_LIMITS.activityDefault, ACQUISITION_WORKSPACE_LIMITS.activityMaximum],
    ["history", input.historyLimit, ACQUISITION_WORKSPACE_LIMITS.historyDefault, ACQUISITION_WORKSPACE_LIMITS.historyMaximum],
    ["priorOffers", input.offerHistoryLimit, ACQUISITION_WORKSPACE_LIMITS.priorOffersDefault, ACQUISITION_WORKSPACE_LIMITS.priorOffersMaximum],
    ["requirements", input.requirementsLimit, ACQUISITION_WORKSPACE_LIMITS.requirementsDefault, ACQUISITION_WORKSPACE_LIMITS.requirementsMaximum],
  ] as const;
  const output: Record<string, number> = {};
  for (const [key, requested, fallback, maximum] of values) {
    const value = requested ?? fallback;
    if (!Number.isInteger(value) || value < 1 || value > maximum) return null;
    output[key] = value;
  }
  return Object.freeze({ activity: output.activity!, history: output.history!, priorOffers: output.priorOffers!, requirements: output.requirements!, blockers: ACQUISITION_WORKSPACE_LIMITS.blockersMaximum, warnings: ACQUISITION_WORKSPACE_LIMITS.warningsMaximum });
}

export function buildOpportunityWorkspaceSummary(source: AcquisitionWorkspaceOpportunitySource): InvestmentOpportunityWorkspaceSummary {
  if (!Number.isInteger(source.version) || source.version < 1) throw new Error("INVALID_OPPORTUNITY_VERSION");
  return deepFreeze({
    id: source.id.value,
    name: source.name,
    location: clone(source.location),
    route: source.route,
    status: source.status,
    archived: source.archived,
    tags: [...source.tags],
    createdAt: new Date(source.createdAt),
    updatedAt: new Date(source.updatedAt),
    ...(source.headlineValue ? { headlineValue: clone(source.headlineValue) } : {}),
  });
}

export function acquisitionAnalysisHref(opportunityId: string, analysisId: string): string {
  return `/dashboard/investments/opportunities/${encodeURIComponent(opportunityId)}/analyses/${encodeURIComponent(analysisId)}`;
}

export function buildAnalysisWorkspaceSummary(source: AcquisitionWorkspaceAnalysisSource | null, opportunity: AcquisitionWorkspaceOpportunitySource, evaluatedAt: Date): InvestmentAnalysisWorkspaceSummary | null {
  if (!source) return null;
  if (!source.opportunityId.equals(opportunity.id) || source.route !== opportunity.route || !source.complete || !Number.isInteger(source.version) || source.version < 1) throw new Error("INVALID_ANALYSIS_SOURCE");
  const days = Math.max(0, Math.floor((evaluatedAt.getTime() - source.analyzedAt.getTime()) / 86_400_000));
  const classification = days >= 90 ? "stale" : days >= 45 ? "aging" : "current";
  return deepFreeze({
    analysisId: source.analysisId.value,
    version: source.version,
    analyzedAt: new Date(source.analyzedAt),
    route: source.route,
    recommendation: source.recommendation,
    ...(source.score !== undefined ? { score: source.score } : {}),
    ...(source.confidence ? { confidence: clone(source.confidence) } : {}),
    ...(source.assumptionFingerprint ? { assumptionFingerprint: source.assumptionFingerprint } : {}),
    age: { days, classification },
    stale: classification === "stale",
    historicalAnalysisHref: acquisitionAnalysisHref(opportunity.id.value, source.analysisId.value),
  });
}

export function buildInfrastructureLimitations(deployment: AcquisitionWorkspaceDeploymentStatus, actionAvailable: boolean, evidenceAvailable: boolean): readonly AcquisitionCapabilityLimitation[] {
  const values: AcquisitionCapabilityLimitation[] = [];
  const writes = ["activate", "manageOffers", "recordContract", "manageRequirements", "prepareClosing", "close", "exit"] as const;
  if (!deployment.remoteTransactionsVerified) values.push({ code: "REMOTE_TRANSACTION_NOT_VERIFIED", affects: writes, severity: "blocking", operatorMessage: "Acquisition changes are unavailable until transaction behavior is verified." });
  if (!deployment.remoteRlsVerified) values.push({ code: "REMOTE_RLS_NOT_VERIFIED", affects: ["read", ...writes], severity: "warning", operatorMessage: "Remote acquisition access controls have not completed verification." });
  if (!actionAvailable) values.push({ code: "ACTION_STATE_UNAVAILABLE", affects: ["manageRequirements", "prepareClosing", "close"], severity: "warning", operatorMessage: "Current linked Action state could not be loaded." });
  if (!evidenceAvailable) values.push({ code: "EVIDENCE_STATE_UNAVAILABLE", affects: ["manageRequirements", "prepareClosing", "close"], severity: "warning", operatorMessage: "Current linked Evidence availability could not be loaded." });
  if (!deployment.documentReaderAvailable) values.push({ code: "DOCUMENT_READER_UNAVAILABLE", affects: ["manageRequirements", "prepareClosing", "close"], severity: "informational", operatorMessage: "Document references are available as counts only." });
  if (!deployment.eventDeliveryDurable) values.push({ code: "EVENT_DELIVERY_NOT_DURABLE", affects: writes, severity: "blocking", operatorMessage: "Acquisition changes remain unavailable until event delivery is durable." });
  return deepFreeze(values);
}

function unavailable(status: AcquisitionCapabilityAvailability["status"], reasonCode: string, blockers: readonly { code: string; message: string }[] = []): AcquisitionCapabilityAvailability {
  if (status === "blocked") return deepFreeze({ status, reasonCode, blockers: [...blockers] });
  if (status === "available") return Object.freeze({ status });
  return Object.freeze({ status, reasonCode } as AcquisitionCapabilityAvailability);
}

export function buildAcquisitionCapabilities(input: Readonly<{
  authorization: AcquisitionWorkspaceAuthorizationSource;
  deployment: AcquisitionWorkspaceDeploymentStatus;
  opportunity: AcquisitionWorkspaceOpportunitySource;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
  pipeline: AcquisitionWorkspacePipelineSource | null;
  actionDependencyAvailable: boolean;
  evidenceDependencyAvailable: boolean;
}>): AcquisitionWorkspaceCapabilities {
  const names = ["activate", "manageOffers", "recordContract", "manageRequirements", "prepareClosing", "close", "exit"] as const;
  const result = {} as Record<keyof AcquisitionWorkspaceCapabilities, AcquisitionCapabilityAvailability>;
  result.read = !input.authorization.authenticated ? unavailable("unauthorized", "NOT_AUTHENTICATED") : !input.authorization.canRead ? unavailable("unauthorized", "NOT_AUTHORIZED") : !input.deployment.readDeployed ? unavailable("not-deployed", "READ_NOT_DEPLOYED") : unavailable("available", "");
  for (const name of names) {
    if (!input.authorization.capabilities[name]) { result[name] = unavailable("unauthorized", "NOT_AUTHORIZED"); continue; }
    if (input.pipeline && isTerminalAcquisitionStage(input.pipeline.stage)) { result[name] = unavailable("not-applicable", "PIPELINE_TERMINAL"); continue; }
    if (name === "activate" && input.pipeline) { result[name] = unavailable("not-applicable", "PIPELINE_ALREADY_EXISTS"); continue; }
    if (name !== "activate" && !input.pipeline) { result[name] = unavailable("not-applicable", "PIPELINE_NOT_ACTIVE"); continue; }
    const blockers = name === "activate" ? activationBlockers(input.opportunity, input.analysis) : domainBlockers(name, input.pipeline!);
    if (blockers.length) { result[name] = unavailable("blocked", "DOMAIN_BLOCKED", blockers); continue; }
    if (!input.deployment.commandsDeployed) { result[name] = unavailable("not-deployed", "COMMANDS_NOT_DEPLOYED"); continue; }
    if (!input.deployment.remoteTransactionsVerified || !input.deployment.remoteRlsVerified) { result[name] = unavailable("not-verified", "REMOTE_INFRASTRUCTURE_NOT_VERIFIED"); continue; }
    if ((name === "manageRequirements" || name === "prepareClosing" || name === "close") && (!input.actionDependencyAvailable || !input.evidenceDependencyAvailable)) { result[name] = unavailable("dependency-unavailable", "CURRENT_STATE_UNAVAILABLE"); continue; }
    result[name] = unavailable("available", "");
  }
  return deepFreeze(result as AcquisitionWorkspaceCapabilities);
}

function activationBlockers(opportunity: AcquisitionWorkspaceOpportunitySource, analysis: InvestmentAnalysisWorkspaceSummary | null) {
  const result: { code: string; message: string }[] = [];
  if (!analysis) result.push({ code: "ANALYSIS_REQUIRED", message: "A completed investment analysis is required." });
  if (analysis && analysis.route !== opportunity.route) result.push({ code: "ANALYSIS_ROUTE_MISMATCH", message: "The analysis route does not match this opportunity." });
  if (opportunity.archived) result.push({ code: "OPPORTUNITY_ARCHIVED", message: "Restore the opportunity before starting acquisition." });
  if (opportunity.status === "acquired") result.push({ code: "OPPORTUNITY_ALREADY_ACQUIRED", message: "This opportunity is already acquired." });
  return result;
}
function domainBlockers(name: string, pipeline: AcquisitionWorkspacePipelineSource) {
  const result: { code: string; message: string }[] = [];
  if (name === "recordContract" && !pipeline.acceptedAgreement) result.push({ code: "AGREEMENT_REQUIRED", message: "An accepted agreement is required." });
  if (name === "prepareClosing" && !pipeline.contract) result.push({ code: "CONTRACT_REQUIRED", message: "A recorded contract is required." });
  if (name === "prepareClosing" && !pipeline.readiness) result.push({ code: "READINESS_REQUIRED", message: "Closing readiness must be evaluated." });
  if (name === "prepareClosing" && pipeline.readiness && pipeline.readiness.evaluatedPipelineVersion !== pipeline.version) result.push({ code: "READINESS_STALE", message: "Closing readiness must be re-evaluated for the current pipeline version." });
  if (name === "prepareClosing" && pipeline.readiness?.blockers.length) result.push({ code: "CLOSING_NOT_READY", message: "Resolve closing-readiness blockers before preparing to close." });
  if (name === "close" && pipeline.stage !== "closing-preparation") result.push({ code: "CLOSING_PREPARATION_REQUIRED", message: "The pipeline must be in closing preparation." });
  if (name === "close" && (!pipeline.readiness || pipeline.readiness.evaluatedPipelineVersion !== pipeline.version)) result.push({ code: "READINESS_STALE", message: "Current closing readiness is required." });
  if (name === "close" && pipeline.readiness?.blockers.length) result.push({ code: "CLOSING_NOT_READY", message: "Resolve closing-readiness blockers before closing." });
  return result;
}

export function buildActivationSummary(opportunity: AcquisitionWorkspaceOpportunitySource, analysis: InvestmentAnalysisWorkspaceSummary | null, capabilities: AcquisitionWorkspaceCapabilities, limitations: readonly AcquisitionCapabilityLimitation[]): AcquisitionActivationSummary {
  const blockers: { code: AcquisitionActivationBlockerCode; message: string }[] = activationBlockers(opportunity, analysis).map(value => ({ code: value.code as AcquisitionActivationBlockerCode, message: value.message }));
  const availability = capabilities.activate;
  if (availability.status !== "available" && availability.status !== "blocked") {
    const code = availability.status === "unauthorized" ? "NOT_AUTHORIZED" : "INFRASTRUCTURE_NOT_VERIFIED";
    blockers.push({ code, message: availability.status === "unauthorized" ? "You are not authorized to activate acquisition." : "Acquisition activation is not deployed and verified." });
  }
  return deepFreeze({ eligible: blockers.length === 0 && availability.status === "available", ...(analysis ? { sourceAnalysisId: analysis.analysisId, sourceAnalysisVersion: analysis.version } : {}), blockers, limitations: [...limitations] });
}

export function buildLifecycleSummary(pipeline: AcquisitionWorkspacePipelineSource, limit: number): AcquisitionLifecycleWorkspaceSummary {
  const progressStages: readonly AcquisitionStage[] = ACQUISITION_STAGES.filter(stage => stage !== "exited");
  const currentIndex = progressStages.indexOf(pipeline.stage);
  const completed = new Map<AcquisitionStage, Date>();
  for (const entry of [...pipeline.stageHistory].sort(byDateAsc)) if (entry.to !== "exited") completed.set(entry.to, entry.occurredAt);
  const stages: import("./contracts").AcquisitionLifecycleStageSummary[] = progressStages.map((stage, index) => ({
    stage, label: stageLabels[stage],
    state: pipeline.stage === "exited" ? completed.has(stage) ? "completed" : "unreachable" : stage === pipeline.stage ? "current" : completed.has(stage) || index < currentIndex ? "completed" : "upcoming",
    ...(completed.has(stage) && stage !== pipeline.stage ? { completedAt: new Date(completed.get(stage)!) } : {}),
  }));
  if (pipeline.stage === "exited") stages.push({ stage: "exited", label: stageLabels.exited, state: "exited" });
  const history = [...pipeline.stageHistory].sort(byDateDesc);
  const transitions = getAllowedAcquisitionStageTransitions(pipeline.stage).map(target => ({
    targetStage: target,
    label: stageLabels[target],
    allowed: true,
    commandType: transitionCommand(target),
    blockers: [],
  } as const));
  return deepFreeze({ currentStage: pipeline.stage, currentStageIndex: pipeline.stage === "exited" ? -1 : currentIndex, stages, availableTransitions: transitions, recentHistory: history.slice(0, limit).map(entry => ({ id: entry.transitionId.value, ...(entry.from ? { from: entry.from } : {}), to: entry.to, occurredAt: new Date(entry.occurredAt), classification: entry.classification })), historyTotalCount: history.length, historyTruncated: history.length > limit });
}

function transitionCommand(stage: AcquisitionStage) {
  if (stage === "offer-submitted") return "submit-offer" as const;
  if (stage === "negotiating") return "record-counter" as const;
  if (stage === "under-contract") return "record-acceptance" as const;
  if (stage === "due-diligence") return "begin-due-diligence" as const;
  if (stage === "closing-preparation") return "begin-closing-preparation" as const;
  if (stage === "closed-acquired") return "close-acquisition" as const;
  if (stage === "exited") return "exit-pipeline" as const;
  return "ordinary-transition" as const;
}

function headlineTerms(terms: AcquisitionOfferTerms): AcquisitionOfferHeadlineTerms {
  return terms.route === "purchase"
    ? deepFreeze({ route: "purchase", offerPrice: clone(terms.offerPrice), financingType: terms.financing.type, ...(terms.proposedClosingDate ? { proposedClosingDate: new Date(terms.proposedClosingDate) } : {}) })
    : deepFreeze({ route: "rental-arbitrage", proposedMonthlyRent: clone(terms.proposedMonthlyRent), leaseTermMonths: terms.leaseTerm.months, ...(terms.proposedCommencementDate ? { proposedCommencementDate: new Date(terms.proposedCommencementDate) } : {}), operatingPermissionRequested: terms.operatingPermission.required });
}
function offerSummary(offer: AcquisitionOffer): AcquisitionOfferWorkspaceSummary {
  const expiration = offer.terms.expiration;
  return deepFreeze({ id: offer.id.value, sequence: offer.sequence.value, status: offer.status, route: offer.route, createdAt: new Date(offer.createdAt), ...(offer.submittedAt ? { submittedAt: new Date(offer.submittedAt) } : {}), ...(expiration ? { expiresAt: new Date(expiration) } : {}), sourceAnalysis: { analysisId: offer.sourceAnalysis.analysisId.value, version: offer.sourceAnalysis.analysisVersion, analyzedAt: new Date(offer.sourceAnalysis.analyzedAt), ...(offer.sourceAnalysis.assumptionFingerprint ? { assumptionFingerprint: offer.sourceAnalysis.assumptionFingerprint } : {}) }, headlineTerms: headlineTerms(offer.terms), current: offer.current, editable: offer.status === "draft" });
}
function contractTerms(contract: AcquisitionContract): AcquisitionContractHeadlineTerms {
  const terms = contract.terms;
  return terms.route === "purchase"
    ? deepFreeze({ route: "purchase", contractPrice: clone(terms.contractPrice), financingType: terms.financing.type, scheduledClosingDate: new Date(terms.scheduledClosingDate) })
    : deepFreeze({ route: "rental-arbitrage", monthlyRent: clone(terms.contractedMonthlyRent), leaseTermMonths: terms.leaseTerm.months, commencementDate: new Date(terms.commencementDate), ...(terms.possessionDate ? { possessionDate: new Date(terms.possessionDate) } : {}) });
}
function contractSummary(contract: AcquisitionContract): AcquisitionContractWorkspaceSummary {
  const source = contract.source.type;
  const terms = contract.terms;
  return deepFreeze({ id: contract.id.value, source, route: contract.route, recordedAt: new Date(contract.recordedAt), effectiveDate: new Date(terms.effectiveDate), headlineTerms: contractTerms(contract), ...(terms.route === "rental-arbitrage" ? { operatingPermission: { status: terms.operatingPermission.status, ...("form" in terms.operatingPermission ? { form: terms.operatingPermission.form } : {}) } } : {}) });
}

export function buildCommercialSummary(pipeline: AcquisitionWorkspacePipelineSource, priorLimit: number): AcquisitionCommercialWorkspaceSummary {
  const ordered = [...pipeline.offers].sort((a, b) => b.sequence.value - a.sequence.value || a.id.value.localeCompare(b.id.value));
  const current = ordered.find(offer => offer.current) ?? null;
  const prior = ordered.filter(offer => offer.id.value !== current?.id.value);
  const responses = [...pipeline.responses].sort((a, b) => b.respondedAt.getTime() - a.respondedAt.getTime() || a.id.value.localeCompare(b.id.value));
  const latest = responses[0];
  const accepted = pipeline.acceptedAgreement;
  const acceptedSummary: AcquisitionAcceptedAgreementWorkspaceSummary | null = accepted ? deepFreeze({ source: accepted.source, acceptedAt: new Date(accepted.acceptedAt), offerId: accepted.offerId.value, ...(accepted.responseId ? { responseId: accepted.responseId.value } : {}), externalReferencePresent: false, headlineTerms: headlineTerms(accepted.acceptedTerms) }) : pipeline.contract?.source.type === "external-agreement" ? deepFreeze({ source: "external", acceptedAt: new Date(pipeline.contract.recordedAt), externalReferencePresent: Boolean(pipeline.contract.source.externalReference), headlineTerms: contractTerms(pipeline.contract) }) : null;
  return deepFreeze({
    currentOffer: current ? offerSummary(current) : null,
    priorOffers: prior.slice(0, priorLimit).map(offer => ({ id: offer.id.value, sequence: offer.sequence.value, status: offer.status, createdAt: new Date(offer.createdAt), ...(offer.submittedAt ? { submittedAt: new Date(offer.submittedAt) } : {}) })),
    priorOfferTotalCount: prior.length,
    priorOffersTruncated: prior.length > priorLimit,
    latestResponse: latest ? { id: latest.id.value, type: latest.type === "acceptance" ? "accepted" : latest.type === "rejection" ? "rejected" : "countered", offerId: latest.offerId.value, respondedAt: new Date(latest.respondedAt), counterpartyType: latest.counterparty.type, ...(latest.terms ? { headlineTerms: headlineTerms(latest.terms) } : {}), ...(latest.explanation ? { explanation: latest.explanation } : {}) } : null,
    acceptedAgreement: acceptedSummary,
    contract: pipeline.contract ? contractSummary(pipeline.contract) : null,
    analysisAlignment: pipeline.analysisAlignment ? clone(pipeline.analysisAlignment) : null,
    contractAlignment: pipeline.contractAlignment ? clone(pipeline.contractAlignment) : null,
  });
}

export function buildRequirementsSummary(pipeline: AcquisitionWorkspacePipelineSource, actionStates: readonly AcquisitionWorkspaceActionState[], evidenceStates: readonly AcquisitionWorkspaceEvidenceState[], evaluatedAt: Date, limit: number): AcquisitionRequirementsWorkspaceSummary {
  const actions = new Map(actionStates.map(value => [value.actionId, value]));
  const evidence = new Map(evidenceStates.map(value => [value.evidenceId, value]));
  const source = [...pipeline.contingencies, ...pipeline.dueDiligenceItems];
  const items = source.map(item => {
    const concerns = item.outcome?.concerns ?? [];
    const highest = [...concerns].sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title))[0];
    const concernSummary: AcquisitionRequirementConcernSummary | undefined = highest ? { highestSeverity: highest.severity, total: concerns.length, blocking: concerns.filter(value => value.blocking).length, headline: highest.title } : undefined;
    const actionIds = item.actionReferences.map(value => value.actionId.value);
    const evidenceIds = item.evidenceReferences.map(value => value.evidenceId.value);
    const evidenceValues = evidenceIds.map(id => evidence.get(id));
    const dependencies = item.requirementType === "contingency"
      ? item.relatedDueDiligenceItemIds.map(value => ({ requirementId: value.value, relationship: "related-diligence" as const }))
      : item.relatedContingencyId ? [{ requirementId: item.relatedContingencyId.value, relationship: "related-contingency" as const }] : [];
    return {
      id: item.id.value,
      kind: item.requirementType,
      title: item.title,
      ...(item.description ? { description: item.description } : {}),
      typeOrCategory: item.requirementType === "contingency" ? item.type : item.category,
      status: item.status,
      priority: item.priority,
      blocking: item.blocking,
      ...(item.dueAt ? { dueAt: new Date(item.dueAt) } : {}),
      overdue: Boolean(item.dueAt && item.dueAt.getTime() < evaluatedAt.getTime() && !resolved.has(item.status)),
      linkedActionCount: actionIds.length,
      evidenceCount: evidenceIds.length,
      documentCount: item.documentReferences.length,
      evidence: {
        linked: evidenceIds.length,
        available: evidenceValues.filter(value => value?.state === "available" && value.available).length,
        unavailable: evidenceValues.filter(value => !value || value.state === "unavailable" || !value.available).length,
        withdrawn: evidenceValues.filter(value => value?.state === "withdrawn").length,
        superseded: evidenceValues.filter(value => value?.state === "superseded").length,
      },
      unavailableActionCount: actionIds.filter(id => !actions.has(id)).length,
      unavailableEvidenceCount: evidenceIds.filter(id => !evidence.get(id)?.available).length,
      dependencies,
      ...(concernSummary ? { concernSummary } : {}),
      ...(item.outcome?.recordedAt ? { resolvedAt: new Date(item.outcome.recordedAt) } : {}),
      updatedAt: new Date(item.updatedAt),
    } satisfies AcquisitionRequirementWorkspaceItem;
  });
  const order = (a: AcquisitionRequirementWorkspaceItem, b: AcquisitionRequirementWorkspaceItem) => Number(b.blocking) - Number(a.blocking) || Number(b.status === "failed") - Number(a.status === "failed") || Number(b.overdue) - Number(a.overdue) || priorityRank[a.priority] - priorityRank[b.priority] || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || a.id.localeCompare(b.id);
  const blocking = items.filter(item => item.blocking && !resolved.has(item.status)).sort(order);
  const high = items.filter(item => item.priority === "critical" || item.priority === "high").sort(order);
  const recent = items.filter(item => resolved.has(item.status)).sort((a, b) => (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0) || a.id.localeCompare(b.id));
  const contingencies = items.filter(item => item.kind === "contingency").sort(order);
  const dueDiligence = items.filter(item => item.kind === "due-diligence").sort(order);
  const risks = source.flatMap(item => (item.outcome?.concerns ?? []).map((concern, index) => ({
    id: `${item.id.value}-risk-${index}`,
    requirementId: item.id.value,
    requirementTitle: item.title,
    title: concern.title,
    summary: concern.summary,
    severity: concern.severity,
    blocking: concern.blocking,
    evidenceCount: concern.evidenceReferences.length,
  }))).sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || Number(b.blocking) - Number(a.blocking) || a.id.localeCompare(b.id));
  const evidenceSummary = items.reduce((total, item) => ({
    linked: total.linked + item.evidence.linked,
    available: total.available + item.evidence.available,
    unavailable: total.unavailable + item.evidence.unavailable,
    withdrawn: total.withdrawn + item.evidence.withdrawn,
    superseded: total.superseded + item.evidence.superseded,
  }), { linked: 0, available: 0, unavailable: 0, withdrawn: 0, superseded: 0 });
  const count = (status: string) => items.filter(item => item.status === status).length;
  return deepFreeze({ initialized: items.length > 0, totals: { contingencies: pipeline.contingencies.length, dueDiligence: pipeline.dueDiligenceItems.length, notStarted: count("not-started"), inProgress: count("in-progress"), satisfied: count("satisfied"), waived: count("waived"), failed: count("failed"), notApplicable: count("not-applicable") }, blocking: blocking.slice(0, limit), blockingTotalCount: blocking.length, blockingTruncated: blocking.length > limit, highPriority: high.slice(0, limit), highPriorityTotalCount: high.length, highPriorityTruncated: high.length > limit, recentlyResolved: recent.slice(0, limit), recentlyResolvedTotalCount: recent.length, recentlyResolvedTruncated: recent.length > limit, contingencies: contingencies.slice(0, limit), contingencyTotalCount: contingencies.length, contingenciesTruncated: contingencies.length > limit, dueDiligence: dueDiligence.slice(0, limit), dueDiligenceTotalCount: dueDiligence.length, dueDiligenceTruncated: dueDiligence.length > limit, risks: risks.slice(0, limit), riskTotalCount: risks.length, risksTruncated: risks.length > limit, evidence: evidenceSummary, waivedCount: count("waived"), failedCount: count("failed"), unresolvedCriticalConcernCount: items.reduce((sum, item) => sum + (item.concernSummary?.highestSeverity === "critical" ? item.concernSummary.blocking : 0), 0) });
}

export function buildClosingReadinessSummary(value: AcquisitionClosingReadiness | undefined, pipelineVersion: number, limits: Pick<AcquisitionWorkspaceResolvedLimits, "blockers" | "warnings">): AcquisitionClosingReadinessWorkspaceSummary | null {
  if (!value) return null;
  const blockers = [...value.blockers].sort((a, b) => a.sourceType.localeCompare(b.sourceType) || a.code.localeCompare(b.code) || (a.sourceId ?? "").localeCompare(b.sourceId ?? ""));
  const warnings = [...value.warnings].sort((a, b) => a.code.localeCompare(b.code) || (a.sourceId ?? "").localeCompare(b.sourceId ?? ""));
  return deepFreeze({ status: value.status, evaluatedAt: new Date(value.evaluatedAt), evaluatedPipelineVersion: value.evaluatedPipelineVersion, current: value.evaluatedPipelineVersion === pipelineVersion, blockers: blockers.slice(0, limits.blockers).map(clone), blockerTotalCount: blockers.length, blockersTruncated: blockers.length > limits.blockers, warnings: warnings.slice(0, limits.warnings).map(clone), warningTotalCount: warnings.length, warningsTruncated: warnings.length > limits.warnings, counts: { requiredContingencies: value.requiredContingencyCount, unresolvedContingencies: value.unresolvedContingencyCount, requiredDiligence: value.requiredDiligenceCount, unresolvedDiligence: value.unresolvedDiligenceCount, waived: value.waivedRequirementCount, failed: value.failedRequirementCount } });
}

function activitySummary(activity: readonly AcquisitionActivity[], limit: number) {
  const values = [...activity].sort(byDateDesc);
  return deepFreeze({ items: values.slice(0, limit).map(item => ({ id: item.id.value, type: item.type, occurredAt: new Date(item.occurredAt), actor: { type: item.actor.type, id: item.actor.id }, summary: activityLabel(item.type), references: activityReferences(item.details) })), totalCount: values.length, truncated: values.length > limit });
}
function activityLabel(type: AcquisitionActivity["type"]) { return type.split("-").map(part => part[0]!.toUpperCase() + part.slice(1)).join(" "); }
function activityReferences(details: Readonly<Record<string, unknown>>) {
  const keys = [["offerId", "offer"], ["responseId", "response"], ["contractId", "contract"], ["contingencyId", "requirement"], ["diligenceItemId", "requirement"], ["stage", "stage"]] as const;
  return keys.flatMap(([key, type]) => typeof details[key] === "string" ? [{ type, id: details[key] as string }] : []);
}

function health(analysis: InvestmentAnalysisWorkspaceSummary | null, pipeline: AcquisitionWorkspacePipelineSource, requirements: AcquisitionRequirementsWorkspaceSummary, readiness: AcquisitionClosingReadinessWorkspaceSummary | null, commercial: AcquisitionCommercialWorkspaceSummary, evaluatedAt: Date): AcquisitionWorkspaceHealth {
  if (isTerminalAcquisitionStage(pipeline.stage)) return deepFreeze({ level: "terminal", reasons: [{ code: pipeline.stage === "exited" ? "PIPELINE_EXITED" : "PIPELINE_ACQUIRED", message: pipeline.stage === "exited" ? "The acquisition pursuit ended." : "The acquisition is complete." }] });
  const reasons: { code: string; message: string }[] = [];
  if (analysis?.stale) reasons.push({ code: "ANALYSIS_STALE", message: "The latest analysis is stale." });
  if (commercial.currentOffer?.expiresAt && commercial.currentOffer.expiresAt.getTime() < evaluatedAt.getTime()) reasons.push({ code: "OFFER_EXPIRED", message: "The current offer has expired." });
  if (requirements.failedCount) reasons.push({ code: "REQUIREMENT_FAILED", message: "A requirement has failed." });
  if (readiness && !readiness.current) reasons.push({ code: "READINESS_STALE", message: "Closing readiness must be recalculated." });
  if (readiness?.status === "not-ready") reasons.push({ code: "CLOSING_BLOCKED", message: "Closing readiness has blockers." });
  return deepFreeze({ level: reasons.some(value => value.code === "REQUIREMENT_FAILED" || value.code === "CLOSING_BLOCKED") ? "blocked" : reasons.length ? "attention" : "healthy", reasons });
}

function terminalOutcome(pipeline: AcquisitionWorkspacePipelineSource): AcquisitionTerminalOutcomeSummary {
  if (pipeline.stage === "closed-acquired") {
    if (!pipeline.closingFacts) throw new Error("TERMINAL_CLOSING_FACTS_MISSING");
    const closingFacts = closingSummary(pipeline.closingFacts);
    const closedAt = closingFacts.route === "purchase" ? closingFacts.closedAt : closingFacts.agreementExecutedAt;
    return deepFreeze({ type: "acquired", closedAt, closingFacts });
  }
  if (pipeline.stage === "exited") {
    if (!pipeline.exit) throw new Error("TERMINAL_EXIT_MISSING");
    return deepFreeze({ type: "exited", exitedAt: new Date(pipeline.exit.exitedAt), exitedFromStage: pipeline.exit.exitedFromStage, reason: pipeline.exit.reason, ...(pipeline.exit.explanation ? { explanation: pipeline.exit.explanation } : {}), reconsiderationEligible: pipeline.exit.reconsideration.eligible, ...(pipeline.exit.reconsideration.eligible && pipeline.exit.reconsideration.notBefore ? { reconsiderationNotBefore: new Date(pipeline.exit.reconsideration.notBefore) } : {}) });
  }
  throw new Error("PIPELINE_NOT_TERMINAL");
}
function closingSummary(facts: AcquisitionClosingFacts): AcquisitionClosingFactsWorkspaceSummary {
  return facts.route === "purchase"
    ? deepFreeze({ route: "purchase", closedAt: new Date(facts.closedAt), finalPurchasePrice: clone(facts.finalPurchasePrice), financingType: facts.financingType })
    : deepFreeze({ route: "rental-arbitrage", agreementExecutedAt: new Date(facts.agreementExecutedAt), commencementAt: new Date(facts.commencementAt), finalMonthlyRent: clone(facts.finalMonthlyRent), operatingPermissionStatus: facts.operatingPermissionStatus });
}

export function buildPipelineWorkspaceSummary(input: Readonly<{ pipeline: AcquisitionWorkspacePipelineSource; analysis: InvestmentAnalysisWorkspaceSummary | null; actionStates: readonly AcquisitionWorkspaceActionState[]; evidenceStates: readonly AcquisitionWorkspaceEvidenceState[]; limits: AcquisitionWorkspaceResolvedLimits; evaluatedAt: Date }>): AcquisitionPipelineWorkspaceSummary | AcquisitionPipelineTerminalWorkspaceSummary {
  const { pipeline } = input;
  if (!Number.isInteger(pipeline.version) || pipeline.version < 1) throw new Error("INVALID_PIPELINE_VERSION");
  const lifecycle = buildLifecycleSummary(pipeline, input.limits.history);
  const commercial = buildCommercialSummary(pipeline, input.limits.priorOffers);
  const requirements = buildRequirementsSummary(pipeline, input.actionStates, input.evidenceStates, input.evaluatedAt, input.limits.requirements);
  const readiness = buildClosingReadinessSummary(pipeline.readiness, pipeline.version, input.limits);
  const activity = activitySummary(pipeline.activity, input.limits.activity);
  const base = { pipelineId: pipeline.id, route: pipeline.route, stage: pipeline.stage, stageLabel: stageLabels[pipeline.stage], stageCategory: getAcquisitionStageDefinition(pipeline.stage).category, activatedAt: new Date(pipeline.activation.activatedAt), activatedBy: { type: pipeline.activation.activatedBy.type, id: pipeline.activation.activatedBy.id }, lifecycle, commercial, requirements, readiness, activity, health: health(input.analysis, pipeline, requirements, readiness, commercial, input.evaluatedAt), updatedAt: new Date(pipeline.updatedAt) };
  return isTerminalAcquisitionStage(pipeline.stage) ? deepFreeze({ ...base, terminal: true, stage: pipeline.stage, outcome: terminalOutcome(pipeline) } as AcquisitionPipelineTerminalWorkspaceSummary) : deepFreeze({ ...base, terminal: false } as AcquisitionPipelineWorkspaceSummary);
}

export function buildNextActions(input: Readonly<{ opportunity: InvestmentOpportunityWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null; pipeline: AcquisitionWorkspacePipelineSource; acquisition: AcquisitionPipelineWorkspaceSummary | AcquisitionPipelineTerminalWorkspaceSummary; capabilities: AcquisitionWorkspaceCapabilities; versions: AcquisitionWorkspaceVersions }>): readonly AcquisitionWorkspaceNextAction[] {
  if (input.acquisition.terminal) return deepFreeze([{ id: "review-analysis", type: "review-analysis", label: "Review investment analysis", description: "Review the analysis that informed this opportunity.", enabled: true, priority: "primary", href: input.analysis?.historicalAnalysisHref ?? `/dashboard/investments/opportunities/${input.opportunity.id}`, blockers: [] }]);
  const stage = input.pipeline.stage;
  const spec = stage === "pursuit" ? ["create-offer", "Create offer", "Prepare the first offer.", "manageOffers", "create-offer"]
    : stage === "offer-preparation" ? [input.acquisition.commercial.currentOffer ? "submit-offer" : "create-offer", input.acquisition.commercial.currentOffer ? "Submit offer" : "Create offer", "Advance the commercial proposal.", "manageOffers", input.acquisition.commercial.currentOffer ? "submit-offer" : "create-offer"]
    : stage === "offer-submitted" || stage === "negotiating" ? ["record-response", "Record response", "Record the counterparty response.", "manageOffers", "record-response"]
    : stage === "under-contract" && !input.acquisition.commercial.contract ? ["record-contract", "Record contract", "Record the executed agreement.", "recordContract", "record-contract"]
    : stage === "under-contract" && !input.acquisition.requirements.initialized ? ["initialize-requirements", "Initialize requirements", "Create the acquisition requirements.", "manageRequirements", "initialize-requirements"]
    : (stage === "under-contract" || stage === "due-diligence") && input.acquisition.readiness?.current && input.acquisition.readiness.status !== "not-ready" ? ["begin-closing-preparation", "Prepare closing", "Confirm current readiness and enter closing preparation.", "prepareClosing", "prepare-closing"]
    : stage === "under-contract" || stage === "due-diligence" ? ["manage-due-diligence", "Manage due diligence", "Resolve priority acquisition requirements.", "manageRequirements", "manage-requirements"]
    : stage === "closing-preparation" ? ["close-acquisition", "Close acquisition", "Record the terminal acquisition outcome.", "close", "close"]
    : ["review-closing-readiness", "Review closing readiness", "Review current closing blockers.", "prepareClosing", "prepare-closing"];
  const [type, label, description, capabilityName, commandType] = spec as [AcquisitionWorkspaceNextAction["type"], string, string, keyof AcquisitionWorkspaceCapabilities, import("./contracts").AcquisitionWorkspaceCommandType];
  const availability = input.capabilities[capabilityName];
  const blockers = availability.status === "blocked" ? availability.blockers : availability.status === "available" ? [] : [{ code: availability.reasonCode, message: capabilityMessage(availability.status) }];
  const primary: AcquisitionWorkspaceNextAction = { id: type, type, label, description, enabled: availability.status === "available", priority: "primary", command: { commandType, opportunityId: input.opportunity.id, pipelineId: input.pipeline.id, expectedOpportunityVersion: input.versions.opportunityVersion, expectedPipelineVersion: input.versions.pipelineVersion }, blockers };
  const exitAvailability = input.capabilities.exit;
  const exitBlockers = exitAvailability.status === "blocked" ? exitAvailability.blockers : exitAvailability.status === "available" ? [] : [{ code: exitAvailability.reasonCode, message: capabilityMessage(exitAvailability.status) }];
  return deepFreeze([primary, { id: "exit-pipeline", type: "exit-pipeline", label: "Exit pursuit", description: "End this acquisition pursuit with a recorded reason.", enabled: exitAvailability.status === "available", priority: "secondary", command: { commandType: "exit", opportunityId: input.opportunity.id, pipelineId: input.pipeline.id, expectedOpportunityVersion: input.versions.opportunityVersion, expectedPipelineVersion: input.versions.pipelineVersion }, blockers: exitBlockers }]);
}
function capabilityMessage(status: string) { return status === "unauthorized" ? "You are not authorized for this action." : status === "not-deployed" ? "This action is not deployed." : status === "not-verified" ? "Required infrastructure is not verified." : status === "dependency-unavailable" ? "Current dependency state is unavailable." : "This action is not available in the current state."; }

export function buildAcquisitionWorkspace(input: Readonly<{ opportunity: AcquisitionWorkspaceOpportunitySource; analysis: AcquisitionWorkspaceAnalysisSource | null; pipeline: AcquisitionWorkspacePipelineSource | null; actionStates: readonly AcquisitionWorkspaceActionState[]; evidenceStates: readonly AcquisitionWorkspaceEvidenceState[]; authorization: AcquisitionWorkspaceAuthorizationSource; deployment: AcquisitionWorkspaceDeploymentStatus; evaluatedAt: Date; limits: AcquisitionWorkspaceResolvedLimits; actionDependencyAvailable: boolean; evidenceDependencyAvailable: boolean }>): AcquisitionWorkspace {
  if (input.pipeline && (!input.pipeline.opportunityId.equals(input.opportunity.id) || input.pipeline.route !== input.opportunity.route)) throw new Error("INVALID_PIPELINE_SOURCE");
  const opportunity = buildOpportunityWorkspaceSummary(input.opportunity);
  const analysis = buildAnalysisWorkspaceSummary(input.analysis, input.opportunity, input.evaluatedAt);
  const limitations = buildInfrastructureLimitations(input.deployment, input.actionDependencyAvailable, input.evidenceDependencyAvailable);
  const capabilities = buildAcquisitionCapabilities({ authorization: input.authorization, deployment: input.deployment, opportunity: input.opportunity, analysis, pipeline: input.pipeline, actionDependencyAvailable: input.actionDependencyAvailable, evidenceDependencyAvailable: input.evidenceDependencyAvailable });
  const versions: AcquisitionWorkspaceVersions = deepFreeze({ opportunityVersion: input.opportunity.version, ...(input.pipeline ? { pipelineVersion: input.pipeline.version } : {}), ...(analysis ? { latestAnalysisVersion: analysis.version } : {}), ...(input.pipeline?.readiness ? { readinessPipelineVersion: input.pipeline.readiness.evaluatedPipelineVersion } : {}) });
  if (!input.pipeline) return deepFreeze({ status: "opportunity-only", opportunity, analysis, activation: buildActivationSummary(input.opportunity, analysis, capabilities, limitations), capabilities, versions, limitations });
  const acquisition = buildPipelineWorkspaceSummary({ pipeline: input.pipeline, analysis, actionStates: input.actionStates, evidenceStates: input.evidenceStates, limits: input.limits, evaluatedAt: input.evaluatedAt });
  const nextActions = buildNextActions({ opportunity, analysis, pipeline: input.pipeline, acquisition, capabilities, versions });
  return acquisition.terminal ? deepFreeze({ status: "pipeline-terminal", opportunity, analysis, acquisition, capabilities, nextActions, versions, limitations } satisfies AcquisitionTerminalWorkspace) : deepFreeze({ status: "pipeline-active", opportunity, analysis, acquisition, capabilities, nextActions, versions, limitations } satisfies AcquisitionActiveWorkspace);
}

function byDateAsc<T extends { occurredAt: Date; transitionId?: { value: string }; id?: { value: string } }>(a: T, b: T) { return a.occurredAt.getTime() - b.occurredAt.getTime() || (a.transitionId?.value ?? a.id?.value ?? "").localeCompare(b.transitionId?.value ?? b.id?.value ?? ""); }
function byDateDesc<T extends { occurredAt: Date; transitionId?: { value: string }; id?: { value: string } }>(a: T, b: T) { return b.occurredAt.getTime() - a.occurredAt.getTime() || (a.transitionId?.value ?? a.id?.value ?? "").localeCompare(b.transitionId?.value ?? b.id?.value ?? ""); }
function clone<T>(value: T): T { return structuredClone(value); }
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
