import type { AutomationCommandPort } from "../application/automation-governed-execution";
import type {
  AutomationCommandEnvelope,
  AutomationDispatchResult,
  GovernedExecutionFailureCode,
} from "../domain/automation-governed-execution";

export const EXECUTE_DRAFT_PLAN_AUTOMATION_CONTRACT = "v1";
export const EXECUTE_DRAFT_PLAN_AUTOMATION_COMMAND = "createDraftPlan";

export type ExecuteDraftPlanAutomationInput = Readonly<{
  commandId: string;
  idempotencyKey: string;
  workspaceId: string;
  propertyIds: readonly string[];
  title: string;
  description?: string;
  priority: "low" | "normal" | "high" | "critical";
  serviceActorId: string;
  initiatingActorId: string;
  correlationId: string;
  causationId: string;
  occurredAt: string;
}>;

/**
 * Execute owns authorization and persistence. This boundary must create a
 * draft plan only; activation and assignment are deliberately unavailable.
 */
export interface ExecuteDraftPlanAutomationBoundary {
  authorize(
    input: ExecuteDraftPlanAutomationInput,
  ): Promise<Readonly<{ allowed: boolean; classification?: GovernedExecutionFailureCode }>>;
  createDraftPlan(
    input: ExecuteDraftPlanAutomationInput,
  ): Promise<AutomationDispatchResult>;
  getCommandStatus(
    commandId: string,
    idempotencyKey: string,
  ): Promise<AutomationDispatchResult>;
}

export function createExecuteDraftPlanAutomationPort(
  boundary: ExecuteDraftPlanAutomationBoundary,
): AutomationCommandPort {
  return Object.freeze({
    capability: "execute",
    contractVersions: Object.freeze([EXECUTE_DRAFT_PLAN_AUTOMATION_CONTRACT]),
    async authorizeAndValidate(envelope: AutomationCommandEnvelope) {
      const parsed = parse(envelope);
      if (!parsed.ok)
        return Object.freeze({
          allowed: false,
          classification: parsed.classification,
        });
      return boundary.authorize(parsed.input);
    },
    async dispatch(envelope: AutomationCommandEnvelope) {
      const parsed = parse(envelope);
      return parsed.ok
        ? boundary.createDraftPlan(parsed.input)
        : Object.freeze({ classification: "validation_rejected" });
    },
    getCommandStatus: (commandId: string, idempotencyKey: string) =>
      boundary.getCommandStatus(commandId, idempotencyKey),
  });
}

export function createUnsupportedAutomationCommandPort(
  capability: "decide" | "outcome-measurement" | "learning" | "recommendations" | "furnishing",
): AutomationCommandPort {
  const unsupported = async (): Promise<AutomationDispatchResult> =>
    Object.freeze({ classification: "unsupported" });
  return Object.freeze({
    capability,
    contractVersions: Object.freeze(["v1"]),
    authorizeAndValidate: async () =>
      Object.freeze({
        allowed: false,
        classification: "COMMAND_CONTRACT_UNSUPPORTED" as const,
      }),
    dispatch: unsupported,
    getCommandStatus: unsupported,
  });
}

export const UNSUPPORTED_AUTOMATION_COMMAND_CAPABILITIES = Object.freeze([
  "decide",
  "outcome-measurement",
  "learning",
  "recommendations",
  "furnishing",
] as const);

type Parsed =
  | Readonly<{ ok: true; input: ExecuteDraftPlanAutomationInput }>
  | Readonly<{
      ok: false;
      classification: GovernedExecutionFailureCode;
    }>;

function parse(envelope: AutomationCommandEnvelope): Parsed {
  if (
    envelope.owningCapability !== "execute" ||
    envelope.commandType !== EXECUTE_DRAFT_PLAN_AUTOMATION_COMMAND ||
    envelope.contractVersion !== EXECUTE_DRAFT_PLAN_AUTOMATION_CONTRACT
  )
    return Object.freeze({
      ok: false,
      classification: "COMMAND_CONTRACT_UNSUPPORTED",
    });
  if (
    envelope.targetType !== "action-plan-draft" ||
    envelope.propertyIds.length === 0 ||
    !envelope.propertyIds.every(nonEmpty)
  )
    return Object.freeze({
      ok: false,
      classification: "COMMAND_VALIDATION_FAILED",
    });
  const title = string(envelope.payload.title),
    description = string(envelope.payload.description),
    priority = envelope.payload.priority ?? "normal";
  if (
    !title ||
    !["low", "normal", "high", "critical"].includes(String(priority))
  )
    return Object.freeze({
      ok: false,
      classification: "COMMAND_VALIDATION_FAILED",
    });
  return Object.freeze({
    ok: true,
    input: Object.freeze({
      commandId: envelope.commandId,
      idempotencyKey: envelope.idempotencyKey,
      workspaceId: envelope.tenantId,
      propertyIds: Object.freeze([...envelope.propertyIds]),
      title,
      ...(description ? { description } : {}),
      priority: priority as ExecuteDraftPlanAutomationInput["priority"],
      serviceActorId: envelope.serviceActorId,
      initiatingActorId: envelope.initiatingActorId,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      occurredAt: envelope.issuedAt,
    }),
  });
}

function string(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonEmpty(value: string) {
  return value.trim().length > 0;
}
