import type { AutomationCommandPort } from "../application/automation-governed-execution";
import {
  createExecuteDraftPlanAutomationPort,
  createUnsupportedAutomationCommandPort,
  UNSUPPORTED_AUTOMATION_COMMAND_CAPABILITIES,
  type ExecuteDraftPlanAutomationBoundary,
} from "./execute-draft-plan-automation-port";

export type AutomationCommandAdapterState = Readonly<{
  capability: string;
  implementation: "supported" | "explicitly-unsupported";
  commandTypes: readonly string[];
  contractVersions: readonly string[];
  productionEnabled: false;
  reason: string;
}>;

export const AUTOMATION_COMMAND_ADAPTER_STATES: readonly AutomationCommandAdapterState[] =
  Object.freeze([
    Object.freeze({
      capability: "execute",
      implementation: "supported",
      commandTypes: Object.freeze(["createDraftPlan"]),
      contractVersions: Object.freeze(["v1"]),
      productionEnabled: false,
      reason:
        "The adapter can create an authorized Execute draft plan only; production identity and dispatch remain disabled.",
    }),
    ...UNSUPPORTED_AUTOMATION_COMMAND_CAPABILITIES.map((capability) =>
      Object.freeze({
        capability,
        implementation: "explicitly-unsupported" as const,
        commandTypes: Object.freeze([]),
        contractVersions: Object.freeze(["v1"]),
        productionEnabled: false as const,
        reason:
          "No owning-capability command boundary is approved; every command is rejected fail-closed.",
      }),
    ),
  ]);

/**
 * Creates the complete AU command-port inventory. Merely constructing this
 * registry does not enable workers or dispatch; production flags and the
 * global kill switch remain authoritative in the governed service.
 */
export function createAutomationCommandAdapterRegistry(input: Readonly<{
  execute: ExecuteDraftPlanAutomationBoundary;
}>): readonly AutomationCommandPort[] {
  return Object.freeze([
    createExecuteDraftPlanAutomationPort(input.execute),
    ...UNSUPPORTED_AUTOMATION_COMMAND_CAPABILITIES.map((capability) =>
      createUnsupportedAutomationCommandPort(capability),
    ),
  ]);
}
