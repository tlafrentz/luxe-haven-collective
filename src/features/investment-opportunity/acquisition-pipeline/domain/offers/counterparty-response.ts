import type { AcquisitionActorReference } from "../acquisition-actor-reference";
import type { AcquisitionOfferId } from "../identifiers";
import type { AcquisitionOfferTerms } from "./acquisition-offer-terms";
import type { AcquisitionStageTransitionId } from "../identifiers";

import type { CounterpartyResponseId } from "../identifiers";
export type CounterpartyReference = Readonly<{ type: "seller" | "landlord" | "listing-agent" | "property-manager" | "other"; externalReference?: string }>;
export type CounterpartyResponse = Readonly<{ id: CounterpartyResponseId; offerId: AcquisitionOfferId; type: "acceptance" | "rejection" | "counter"; counterparty: CounterpartyReference; respondedAt: Date; recordedAt: Date; recordedBy: AcquisitionActorReference; explanation?: string; terms?: AcquisitionOfferTerms }>;
export type AcceptedAgreementBasis = Readonly<{ source: "offer" | "counteroffer"; offerId: AcquisitionOfferId; responseId?: CounterpartyResponseId; acceptedTerms: AcquisitionOfferTerms; acceptedAt: Date }>;
