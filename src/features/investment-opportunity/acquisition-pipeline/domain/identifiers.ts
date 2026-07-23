import { Identifier } from "@/platform/kernel";
import { AcquisitionDomainError } from "./errors";

export type AcquisitionPipelineId = Identifier<`acquisition-pipeline-${string}`>;
export type AcquisitionStageTransitionId = Identifier<`acquisition-stage-transition-${string}`>;
export type AcquisitionCommandId = Identifier<`acquisition-command-${string}`>;
export type AcquisitionOfferId = Identifier<`acquisition-offer-${string}`>;
export type AcquisitionContractId = Identifier<`acquisition-contract-${string}`>;
export type CounterpartyResponseId = Identifier<`counterparty-response-${string}`>;

function createId<T extends string>(value: string | undefined, prefix: string, code: import("./errors").AcquisitionErrorCode): Identifier<T> {
  const candidate = value ?? `${prefix}${crypto.randomUUID()}`;
  if (!candidate.trim() || !candidate.startsWith(prefix)) throw new AcquisitionDomainError(code);
  return Identifier.create(candidate as T);
}

export const createAcquisitionPipelineId = (value?: string): AcquisitionPipelineId => createId(value, "acquisition-pipeline-", "INVALID_ACQUISITION_PIPELINE_ID");
export const createAcquisitionStageTransitionId = (value?: string): AcquisitionStageTransitionId => createId(value, "acquisition-stage-transition-", "INVALID_ACQUISITION_TRANSITION_ID");
export const createAcquisitionCommandId = (value?: string): AcquisitionCommandId => createId(value, "acquisition-command-", "INVALID_ACQUISITION_COMMAND_ID");
export const createAcquisitionOfferId = (value?: string): AcquisitionOfferId => createId(value, "acquisition-offer-", "INVALID_ACQUISITION_OFFER_ID");
export const createAcquisitionContractId = (value?: string): AcquisitionContractId => createId(value, "acquisition-contract-", "INVALID_ACQUISITION_CONTRACT_ID");
export const createCounterpartyResponseId = (value?: string): CounterpartyResponseId => createId(value, "counterparty-response-", "INVALID_COUNTERPARTY_RESPONSE_ID");
