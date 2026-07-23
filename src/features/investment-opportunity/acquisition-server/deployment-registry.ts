import { ACQUISITION_SERVER_COMMAND_TYPES, type AcquisitionServerCommandRollout, type AcquisitionServerCommandType } from "./contracts";

export type AcquisitionCommandDeploymentAvailability =
  | Readonly<{ status: "enabled" }>
  | Readonly<{ status: "read-model-only"; reasonCode: string }>
  | Readonly<{ status: "not-deployed"; reasonCode: string }>
  | Readonly<{ status: "not-verified"; reasonCode: string }>
  | Readonly<{ status: "dependency-unavailable"; dependency: string }>;
export type AcquisitionCommandDeploymentRegistry = Readonly<Record<AcquisitionServerCommandType, AcquisitionCommandDeploymentAvailability>>;

const implemented = new Set<AcquisitionServerCommandType>([
  "activate-pipeline", "transition-stage", "exit-pipeline", "begin-closing-preparation",
  "close-acquisition", "create-offer-draft", "submit-offer", "record-contract",
]);

export function createFailClosedAcquisitionCommandRegistry(): AcquisitionCommandDeploymentRegistry {
  return Object.freeze(Object.fromEntries(ACQUISITION_SERVER_COMMAND_TYPES.map((command) => [
    command,
    implemented.has(command)
      ? Object.freeze({ status: "not-verified", reasonCode: "REMOTE_TRANSACTION_AND_RLS_NOT_VERIFIED" })
      : Object.freeze({ status: "read-model-only", reasonCode: "APPLICATION_HANDLER_NOT_IMPLEMENTED" }),
  ])) as Record<AcquisitionServerCommandType, AcquisitionCommandDeploymentAvailability>);
}

export function classifyAcquisitionServerCommandRollout(value: AcquisitionCommandDeploymentAvailability): AcquisitionServerCommandRollout {
  if (value.status === "not-verified") return "not-remotely-verified";
  if (value.status === "dependency-unavailable") return "dependency-unavailable";
  return value.status;
}
