import { ProductionVerificationError } from "./model";

export type VerificationScenarioCategory = "release_identity" | "commercial" | "customer_account" | "onboarding" | "first_value" | "admin_operations" | "authorization" | "concurrency" | "recovery" | "telemetry" | "cleanup";
export type VerificationScenarioDefinition = Readonly<{
  code: string; version: number; category: VerificationScenarioCategory;
  productFamily?: "hpm" | "guidebook" | "furnishing" | "investment_intelligence";
  requiredIdentityRoles: readonly string[]; prerequisiteScenarioCodes: readonly string[];
  executorCode: string; evaluatorCode: string; cleanupOperationCode?: string;
  expectedOutcomeCode: string; requiredEvidenceCodes: readonly string[];
  timeoutPolicyCode: string; retryPolicyCode: string; blocking: boolean;
  status: "draft" | "active" | "retired";
  executionMode: "authoritative_mutation" | "observation";
  authorityCode: "release" | "commerce" | "customer_account" | "onboarding" | "first_value" | "admin_activation" | "security" | "operations";
}>;

export const VERIFICATION_RETRY_POLICIES = Object.freeze([{ code: "SAFE_IDEMPOTENT_V1", version: 1, maximumAttempts: 3, retryableResultCodes: ["TRANSIENT_UPSTREAM_FAILURE", "TIMEOUT_AFTER_EFFECT", "EVIDENCE_PENDING"] }]);
export const VERIFICATION_TIMEOUT_POLICIES = Object.freeze([{ code: "PRODUCTION_BOUNDED_V1", version: 1, timeoutSeconds: 120, timeoutResultCode: "SCENARIO_TIMED_OUT" }]);
export const VERIFICATION_CLEANUP_POLICIES = Object.freeze([{ code: "EXACT_OWNING_DOMAIN_V1", version: 1, operationCode: "EXACT_RESOURCE_CLEANUP", forbidReusedResources: true }]);
export const VERIFICATION_GATE_POLICIES = Object.freeze([{ code: "ALL_REQUIRED_AND_CLEAN_V1", version: 1, requireReviewer: true, requireManualObservations: true, requireExactCleanup: true }]);
export const MANUAL_OBSERVATION_DEFINITIONS = Object.freeze([
  { code: "HPM_USABILITY", version: 1, scenarioCode: "PV-007" }, { code: "GUIDEBOOK_EDITABILITY", version: 1, scenarioCode: "PV-009" },
  { code: "FURNISHING_BRIEF_REVIEWABILITY", version: 1, scenarioCode: "PV-011" }, { code: "INVESTMENT_DISCLOSURE_CLARITY", version: 1, scenarioCode: "PV-012" },
  { code: "ADMIN_ACTIVATION_USABILITY", version: 1, scenarioCode: "PV-018" }, { code: "CUSTOMER_ADMIN_ACCESSIBILITY", version: 1, scenarioCode: "PV-027" },
]);

const authorityFor = (category: VerificationScenarioCategory) => category === "release_identity" ? "release" : category === "commercial" ? "commerce" : category === "customer_account" ? "customer_account" : category === "onboarding" ? "onboarding" : category === "first_value" ? "first_value" : category === "admin_operations" ? "admin_activation" : category === "authorization" ? "security" : "operations";
const observational = new Set(["PV-001", "PV-002", "PV-008", "PV-010", "PV-016", "PV-017", "PV-020", "PV-021", "PV-022", "PV-023", "PV-024", "PV-027", "PV-028", "PV-031"]);

const scenario = (code: string, category: VerificationScenarioCategory, prerequisites: readonly string[] = [], productFamily?: VerificationScenarioDefinition["productFamily"]): VerificationScenarioDefinition => Object.freeze({
  code, version: 1, category, productFamily, requiredIdentityRoles: ["release_verifier"], prerequisiteScenarioCodes: prerequisites,
  executorCode: `EXECUTE_${code}`, evaluatorCode: `EVALUATE_${code}`, cleanupOperationCode: category === "cleanup" ? "EXACT_RESOURCE_CLEANUP" : undefined,
  expectedOutcomeCode: `${code}_PASS`, requiredEvidenceCodes: [`${code}_CANONICAL_EVIDENCE`], timeoutPolicyCode: "PRODUCTION_BOUNDED_V1", retryPolicyCode: "SAFE_IDEMPOTENT_V1", blocking: true, status: "active",
  executionMode: observational.has(code) ? "observation" : "authoritative_mutation", authorityCode: authorityFor(category),
});

export const VERIFICATION_SCENARIOS = Object.freeze([
  scenario("PV-001", "release_identity"), scenario("PV-002", "release_identity", ["PV-001"]),
  scenario("PV-003", "commercial", ["PV-002"]), scenario("PV-004", "commercial", ["PV-002"]),
  scenario("PV-005", "customer_account", ["PV-003"]), scenario("PV-006", "concurrency", ["PV-005"]),
  scenario("PV-007", "first_value", ["PV-005"], "hpm"), scenario("PV-008", "first_value", ["PV-007"], "hpm"),
  scenario("PV-009", "first_value", ["PV-005"], "guidebook"), scenario("PV-010", "authorization", ["PV-009"], "guidebook"),
  scenario("PV-011", "first_value", ["PV-005"], "furnishing"), scenario("PV-012", "first_value", ["PV-005"], "investment_intelligence"),
  scenario("PV-013", "recovery", ["PV-012"], "investment_intelligence"), scenario("PV-014", "concurrency", ["PV-012"], "investment_intelligence"),
  scenario("PV-015", "first_value", ["PV-007", "PV-009"]), scenario("PV-016", "first_value", ["PV-005"]), scenario("PV-017", "first_value", ["PV-005"]),
  scenario("PV-018", "admin_operations", ["PV-005"]), scenario("PV-019", "admin_operations", ["PV-018"]),
  scenario("PV-020", "authorization", ["PV-018"]), scenario("PV-021", "authorization", ["PV-002"]), scenario("PV-022", "authorization", ["PV-002"]), scenario("PV-023", "authorization", ["PV-002"]),
  scenario("PV-024", "authorization", ["PV-005"]), scenario("PV-025", "concurrency", ["PV-005"]), scenario("PV-026", "recovery", ["PV-005"]),
  scenario("PV-027", "authorization", ["PV-007", "PV-009", "PV-011", "PV-012"]), scenario("PV-028", "telemetry", ["PV-003"]), scenario("PV-029", "recovery", ["PV-005"]),
  scenario("PV-030", "cleanup", ["PV-003"]), scenario("PV-031", "release_identity", ["PV-001", "PV-002", "PV-003", "PV-004", "PV-005", "PV-006", "PV-007", "PV-008", "PV-009", "PV-010", "PV-011", "PV-012", "PV-013", "PV-014", "PV-015", "PV-016", "PV-017", "PV-018", "PV-019", "PV-020", "PV-021", "PV-022", "PV-023", "PV-024", "PV-025", "PV-026", "PV-027", "PV-028", "PV-029", "PV-030"]),
] satisfies readonly VerificationScenarioDefinition[]);

export const CA001F_PLAN = Object.freeze({ code: "CA001_PRODUCTION_RELEASE", version: 1, milestoneCode: "CA-001F", supportedEnvironment: "production", requiredScenarioCodes: VERIFICATION_SCENARIOS.map(s => s.code), optionalScenarioCodes: [], releaseGatePolicyCode: "ALL_REQUIRED_AND_CLEAN_V1", cleanupPolicyCode: "EXACT_OWNING_DOMAIN_V1", evidencePolicyCode: "CANONICAL_REFERENCES_V1", status: "active" as const });
export const VERIFICATION_EVIDENCE_DEFINITIONS = Object.freeze(VERIFICATION_SCENARIOS.map(s => Object.freeze({ code: s.requiredEvidenceCodes[0], version: 1, scenarioCode: s.code, sourceAuthorityCode: s.authorityCode, required: true })));

export function validateVerificationRegistry() {
  const codes = new Set(VERIFICATION_SCENARIOS.map(s => s.code));
  if (codes.size !== VERIFICATION_SCENARIOS.length) throw new ProductionVerificationError("DUPLICATE_SCENARIO_CODE");
  for (const definition of VERIFICATION_SCENARIOS) for (const prerequisite of definition.prerequisiteScenarioCodes) if (!codes.has(prerequisite)) throw new ProductionVerificationError("UNKNOWN_SCENARIO_PREREQUISITE");
  if (CA001F_PLAN.requiredScenarioCodes.some(code => !codes.has(code))) throw new ProductionVerificationError("UNKNOWN_REQUIRED_SCENARIO");
  if (VERIFICATION_EVIDENCE_DEFINITIONS.length !== VERIFICATION_SCENARIOS.length) throw new ProductionVerificationError("EVIDENCE_REGISTRY_INCOMPLETE");
  return true;
}
