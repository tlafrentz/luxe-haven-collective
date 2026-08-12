import { ProductionVerificationError, VerificationEvidence } from "../domain";
import { VERIFICATION_SCENARIOS } from "../domain/registry";
import type { VerificationExecutorPort } from "./execution";

export type AuthoritativeScenarioInput = { runId: string; scenarioInstanceId: string; controlledIdentityId: string; correlationId: string };
export interface AuthoritativeScenarioAuthority { execute(operationCode: string, input: AuthoritativeScenarioInput): Promise<{ stableResultCode: string; canonicalReference?: { type: string; id: string } }>; }
export type ScenarioAuthoritySet = Readonly<Record<"release" | "commerce" | "customer_account" | "onboarding" | "first_value" | "admin_activation" | "security" | "operations", AuthoritativeScenarioAuthority>>;

export class AuthoritativeVerificationExecutor implements VerificationExecutorPort {
  constructor(private readonly authorities: ScenarioAuthoritySet) {}
  async execute(executorCode: string, input: AuthoritativeScenarioInput) {
    const definition = VERIFICATION_SCENARIOS.find(s => s.executorCode === executorCode);
    if (!definition) throw new ProductionVerificationError("EXECUTOR_NOT_REGISTERED");
    const authority = this.authorities[definition.authorityCode];
    if (!authority) throw new ProductionVerificationError("AUTHORITATIVE_ADAPTER_UNAVAILABLE");
    return authority.execute(executorCode, input);
  }
}

export type CanonicalEvidenceQuery = { runId: string; scenarioInstanceId: string; candidateId: string; tenantId?: string; asOf: Date };
export interface CanonicalEvidenceAuthority { resolve(evidenceCode: string, query: CanonicalEvidenceQuery): Promise<VerificationEvidence | null>; }
export type EvidenceAuthoritySet = Readonly<Record<string, CanonicalEvidenceAuthority>>;

export class CanonicalScenarioEvaluator {
  constructor(private readonly authorities: EvidenceAuthoritySet) {}
  async evaluate(input: CanonicalEvidenceQuery & { scenarioCode: string; scenarioVersion: number }) {
    const scenario = VERIFICATION_SCENARIOS.find(s => s.code === input.scenarioCode && s.version === input.scenarioVersion);
    if (!scenario) throw new ProductionVerificationError("EVALUATOR_NOT_REGISTERED");
    const authority = this.authorities[scenario.authorityCode];
    if (!authority) throw new ProductionVerificationError("CANONICAL_EVIDENCE_ADAPTER_UNAVAILABLE");
    const evidence: VerificationEvidence[] = [];
    for (const evidenceCode of scenario.requiredEvidenceCodes) {
      const value = await authority.resolve(evidenceCode, input);
      if (!value || value.verificationRunId !== input.runId || value.scenarioInstanceId !== input.scenarioInstanceId || value.evidenceCode !== evidenceCode || value.classification !== "valid" || value.capturedAt > input.asOf || (value as VerificationEvidence & { releaseCandidateId?: string }).releaseCandidateId && (value as VerificationEvidence & { releaseCandidateId?: string }).releaseCandidateId !== input.candidateId) throw new ProductionVerificationError("CANONICAL_EVIDENCE_INVALID");
      evidence.push(value);
    }
    return Object.freeze({ passed: true, expectedOutcomeCode: scenario.expectedOutcomeCode, evidence: Object.freeze(evidence) });
  }
}

export function validateAdapterCoverage(input: { executorCodes: readonly string[]; evaluatorCodes: readonly string[]; cleanupOperationCodes: readonly string[] }) {
  const missing: string[] = [];
  for (const scenario of VERIFICATION_SCENARIOS) {
    if (!input.executorCodes.includes(scenario.executorCode)) missing.push(`executor:${scenario.code}`);
    if (!input.evaluatorCodes.includes(scenario.evaluatorCode)) missing.push(`evaluator:${scenario.code}`);
    if (scenario.cleanupOperationCode && !input.cleanupOperationCodes.includes(scenario.cleanupOperationCode)) missing.push(`cleanup:${scenario.code}`);
  }
  return Object.freeze(missing);
}
