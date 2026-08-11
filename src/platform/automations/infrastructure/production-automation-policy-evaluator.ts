import type {
  AutomationPolicyEvaluator,
} from "../application/automation-governed-execution";
import type { AutomationPolicyDecision } from "../domain/automation-governed-execution";

export type ProductionAutomationCohortPolicy = Readonly<{
  tenantId: string;
  propertyIds: readonly string[];
  definitionIds: readonly string[];
  commandTypes: readonly string[];
  dispatchEnabled: boolean;
  approvalRequired: boolean;
  categoricalHalt: boolean;
  policyVersion: string;
}>;

export function createProductionAutomationPolicyEvaluator(input: Readonly<{
  cohort: ProductionAutomationCohortPolicy;
  id?: () => string;
}>): AutomationPolicyEvaluator {
  const evaluator: AutomationPolicyEvaluator = {
    async evaluate(value) {
      const { run, request, plan, now } = value;
      const missing: string[] = [];
      if (input.cohort.categoricalHalt) missing.push("categorical-halt");
      if (run.tenantId !== input.cohort.tenantId) missing.push("tenant");
      if (!input.cohort.definitionIds.includes(run.automationDefinitionId))
        missing.push("definition");
      if (
        run.propertyIds.length === 0 ||
        run.propertyIds.some((id) => !input.cohort.propertyIds.includes(id)) ||
        !same(run.propertyIds, request.scope.propertyIds)
      )
        missing.push("property");
      if (
        plan.steps.length !== 1 ||
        plan.steps.some(
          (step) =>
            step.owningCapability !== "execute" ||
            !input.cohort.commandTypes.includes(step.commandType),
        )
      )
        missing.push("command");

      const disposition: AutomationPolicyDecision["disposition"] = missing.length
        ? "prohibited"
        : input.cohort.approvalRequired || !input.cohort.dispatchEnabled
          ? "approval_required"
          : "permitted_without_additional_approval";
      return Object.freeze({
        id: input.id?.() ?? crypto.randomUUID(),
        runId: run.id,
        disposition,
        policyVersion: input.cohort.policyVersion,
        targetContextVersion: `cohort:${input.cohort.policyVersion}:${run.automationDefinitionVersionId}`,
        matchedRules: Object.freeze(
          missing.length
            ? []
            : ["exact-tenant", "exact-property", "exact-definition", "execute-draft-plan-only"],
        ),
        missingFacts: Object.freeze(missing),
        safeExplanation: missing.length
          ? "The run is outside the approved production automation policy."
          : !input.cohort.dispatchEnabled
            ? "The run is eligible for inspection, but command dispatch is disabled."
          : input.cohort.approvalRequired
            ? "The exact internal cohort is eligible after a version-bound approval."
            : "The exact internal cohort is eligible for draft-plan dispatch.",
        evaluatedAt: now,
      });
    },
  };
  return Object.freeze(evaluator);
}

function same(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}
