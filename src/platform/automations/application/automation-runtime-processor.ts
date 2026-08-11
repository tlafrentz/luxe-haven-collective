import type { AutomationActor } from "../domain/automation-definition";
import type { SchedulerActor } from "./automation-trigger-processing";
import type {
  AutomationApproval,
  AutomationRun,
  AutomationRunStep,
} from "../domain/automation-governed-execution";
import type { AutomationRunRequest } from "../domain/automation-triggering";
import type { AutomationDefinitionExecutionReader } from "./automation-governed-execution";

export type AutomationRuntimeSummary = Readonly<{
  correlationId: string;
  schedulesEvaluated: number;
  requestsAccepted: number;
  requestsProcessed: number;
  runsCompleted: number;
  awaitingApproval: number;
  quarantined: number;
  failed: number;
}>;

type Result<T> = Readonly<{ ok: true; value: T } | { ok: false; code: string }>;
export type RuntimeGovernedService = Readonly<{
  materialize(input: Readonly<{ request: AutomationRunRequest; actor: AutomationActor; serviceActorPolicyId: string }>): Promise<Result<Readonly<{ run: AutomationRun; steps: readonly AutomationRunStep[]; created: boolean }>>>;
  evaluatePolicy(input: Readonly<{ request: AutomationRunRequest; runId: string; expectedVersion: number; actor: AutomationActor }>): Promise<Result<AutomationRun>>;
  dispatch(input: Readonly<{ tenantId: string; runId: string; stepId: string; expectedRunVersion: number; expectedStepVersion: number; workerId: string; targetType: string; targetId: string; targetContextVersion: string; policyVersion: string; payload: Readonly<Record<string, unknown>>; approval?: AutomationApproval }>): Promise<Result<Readonly<{ run: AutomationRun; step: AutomationRunStep }>>>;
  finalize(input: Readonly<{ tenantId: string; runId: string; expectedRunVersion: number }>): Promise<Result<AutomationRun>>;
}>;

export function createAutomationRuntimeProcessor(input: Readonly<{
  enabled: () => boolean;
  scheduler: Readonly<{ scanDueSchedules(value: Readonly<{ actor: SchedulerActor; tenantId: string; partitionKey: string; through: string; correlationId: string; maximumCount: number }>): Promise<Result<Readonly<{ processed: number; accepted: number }>>> }>;
  requests: Readonly<{ listRequested(tenantId: string, limit: number): Promise<readonly AutomationRunRequest[]> }>;
  runs: Readonly<{ getRun(tenantId: string, runId: string): Promise<AutomationRun | null>; getSteps(tenantId: string, runId: string): Promise<readonly AutomationRunStep[]>; getApproval(tenantId: string, approvalId: string): Promise<AutomationApproval | null> }>;
  definitions: AutomationDefinitionExecutionReader;
  governed: RuntimeGovernedService;
  actor: SchedulerActor;
  workerId: string;
  serviceActorPolicyId: string;
  policyVersion: string;
  maximumRequests: number;
  clock?: () => string;
  telemetry?: Readonly<{ emit(event: Readonly<Record<string, string | number>>): void }>;
}>) {
  return Object.freeze({
    async process(correlationId: string): Promise<AutomationRuntimeSummary> {
      if (!input.enabled()) throw new Error("AUTOMATION_KILL_SWITCHED");
      const through = input.clock?.() ?? new Date().toISOString();
      const schedule = await input.scheduler.scanDueSchedules({ actor: input.actor, tenantId: input.actor.tenantId, partitionKey: `automation:${input.actor.tenantId}`, through, correlationId, maximumCount: input.maximumRequests });
      if (!schedule.ok) throw new Error(schedule.code);
      const requests = await input.requests.listRequested(input.actor.tenantId, input.maximumRequests);
      let completed = 0, awaitingApproval = 0, quarantined = 0, failed = 0, processed = 0;
      for (const request of requests.slice(0, input.maximumRequests)) {
        if (!input.enabled()) break;
        processed += 1;
        const materialized = await input.governed.materialize({ request, actor: input.actor, serviceActorPolicyId: input.serviceActorPolicyId });
        if (!materialized.ok) { failed += 1; signal("materialize_failed", request, materialized.code); continue; }
        let run = materialized.value.run;
        if (run.status === "pending_policy_evaluation") {
          const evaluated = await input.governed.evaluatePolicy({ request, runId: run.id, expectedVersion: run.version, actor: input.actor });
          if (!evaluated.ok) { failed += 1; signal("policy_failed", request, evaluated.code); continue; }
          run = evaluated.value;
        }
        if (run.status === "awaiting_approval") { awaitingApproval += 1; continue; }
        if (["succeeded", "partially_succeeded", "failed", "cancelled", "expired"].includes(run.status)) { if (run.status === "succeeded") completed += 1; continue; }
        const definition = await input.definitions.getExecution({ tenantId: run.tenantId, automationId: run.automationDefinitionId, version: run.automationDefinitionVersion });
        if (!definition || definition.definitionVersionId !== run.automationDefinitionVersionId) { failed += 1; signal("definition_unavailable", request, "DEFINITION_VERSION_UNAVAILABLE"); continue; }
        const steps = await input.runs.getSteps(run.tenantId, run.id);
        const step = steps.find(({ status }) => status === "ready");
        if (!step) continue;
        const planned = definition.plan.steps.find(({ key }) => key === step.stepKey);
        if (!planned) { failed += 1; continue; }
        const approval = run.approvalId ? await input.runs.getApproval(run.tenantId, run.approvalId) : undefined;
        const dispatched = await input.governed.dispatch({ tenantId: run.tenantId, runId: run.id, stepId: step.id, expectedRunVersion: run.version, expectedStepVersion: step.version, workerId: input.workerId, targetType: "action-plan-draft", targetId: run.automationDefinitionId, targetContextVersion: `cohort:${input.policyVersion}:${run.automationDefinitionVersionId}`, policyVersion: input.policyVersion, payload: planned.payload, ...(approval ? { approval } : {}) });
        if (!dispatched.ok) { if (["COMMAND_OUTCOME_UNCERTAIN", "RECONCILIATION_REQUIRED"].includes(dispatched.code)) quarantined += 1; else failed += 1; signal("dispatch_failed", request, dispatched.code); continue; }
        const finalized = await input.governed.finalize({ tenantId: run.tenantId, runId: run.id, expectedRunVersion: dispatched.value.run.version });
        if (!finalized.ok) { failed += 1; signal("finalize_failed", request, finalized.code); continue; }
        if (finalized.value.status === "succeeded") completed += 1;
        if (finalized.value.status === "reconciliation_required") quarantined += 1;
      }
      return Object.freeze({ correlationId, schedulesEvaluated: schedule.value.processed, requestsAccepted: schedule.value.accepted, requestsProcessed: processed, runsCompleted: completed, awaitingApproval, quarantined, failed });
    },
  });

  function signal(name: string, request: AutomationRunRequest, classification: string) {
    input.telemetry?.emit({ name, correlationId: request.correlationId, requestId: request.id, classification });
  }
}
