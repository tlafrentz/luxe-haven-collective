import type { Action, ActionType } from "@/platform/actions";
import { createOutcomeId, emptyOutcomeLineage, Outcome } from "@/platform/outcomes";

export type ProviderCommand = Readonly<{
  provider: string;
  operation: string;
  idempotencyKey: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type ProviderExecutionResult = Readonly<{
  successful: boolean;
  externalExecutionId?: string;
  statusCode?: number;
  retryable?: boolean;
  errorCode?: string;
  message: string;
  startedAt: Date;
  completedAt: Date;
}>;

export interface OutboundActionProvider {
  readonly provider: string;
  readonly supportedActionTypes: readonly ActionType[];
  map(action: Action): ProviderCommand;
  execute(command: ProviderCommand): Promise<ProviderExecutionResult>;
}

export type IntegrationActionExecution = Readonly<{
  action: Action;
  command: ProviderCommand;
  result: ProviderExecutionResult;
  technicalOutcome: Outcome;
}>;

/** Executes an already-approved canonical Action; never creates or approves work. */
export async function executeIntegrationAction(action: Action, provider: OutboundActionProvider): Promise<IntegrationActionExecution> {
  if (!action.decisionIds.length) throw new Error("Integration execution requires an Action with Decision lineage.");
  if (action.status !== "accepted" && action.status !== "scheduled" && action.status !== "in-progress") {
    throw new Error(`Integration cannot execute Action with status "${action.status}".`);
  }
  if (!provider.supportedActionTypes.includes(action.type)) throw new Error(`${provider.provider} does not support Action type "${action.type}".`);
  const command = provider.map(action);
  if (command.provider !== provider.provider) throw new Error("Provider command identity does not match the executing provider.");
  if (command.idempotencyKey !== action.id.value) throw new Error("Provider command idempotency key must equal the canonical Action id.");
  const result = await provider.execute(command);
  const lineage = emptyOutcomeLineage();
  const technicalOutcome = Outcome.create({
    id: createOutcomeId(`outcome-integration-${slug(provider.provider)}-${slug(action.id.value)}`),
    title: `${provider.provider} execution ${result.successful ? "completed" : "failed"}`,
    summary: result.message,
    type: "integration-execution",
    status: result.successful ? "completed" : "failed",
    successful: result.successful,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    result: {
      provider: provider.provider,
      operation: command.operation,
      ...(result.externalExecutionId ? { externalExecutionId: result.externalExecutionId } : {}),
      ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }),
      retryable: result.retryable ?? false,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    },
    lineage: { ...lineage, actionIds: [action.id], decisionIds: action.decisionIds },
    metadata: { idempotencyKey: command.idempotencyKey, technicalOutcome: true },
  });
  return Object.freeze({ action, command, result, technicalOutcome });
}

function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
