import type { AcquisitionActorReference } from "../acquisition-actor-reference";
import type { AcquisitionPipelineId } from "../identifiers";
import type { AcquisitionContractTerms } from "./acquisition-contract-terms";
import type { AcquisitionContractId } from "../identifiers";
export type AcquisitionContractStatus = "recorded";
export type AcquisitionContractSource = Readonly<{ type: "accepted-offer"; offerId: import("../offers").AcquisitionOfferId } | { type: "accepted-counteroffer"; offerId: import("../offers").AcquisitionOfferId; responseId: import("../offers").CounterpartyResponseId } | { type: "external-agreement"; externalReference?: string; explanation: string }>;
export type AcquisitionContract = Readonly<{ id: AcquisitionContractId; pipelineId: AcquisitionPipelineId; route: AcquisitionContractTerms["route"]; status: AcquisitionContractStatus; source: AcquisitionContractSource; terms: AcquisitionContractTerms; recordedBy: AcquisitionActorReference; recordedAt: Date }>;
