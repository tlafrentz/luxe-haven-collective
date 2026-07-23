import type { InvestmentOpportunityRoute } from "@/features/investment-opportunity/domain";
import type { AcquisitionActorReference } from "../acquisition-actor-reference";
import type { AcquisitionPipelineId, AcquisitionOfferId } from "../identifiers";
import type { AcquisitionOfferTerms } from "./acquisition-offer-terms";

export type AcquisitionOfferStatus = "draft" | "submitted" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired" | "superseded";
export type AcquisitionOfferSequence = Readonly<{ value: number }>;
export type OfferSourceAnalysisReference = Readonly<{ analysisId: import("@/features/investment-opportunity/domain").OpportunityAnalysisId; analysisVersion: number; analyzedAt: Date; route: InvestmentOpportunityRoute; assumptionFingerprint?: string }>;
export type AcquisitionOffer = Readonly<{ id: AcquisitionOfferId; pipelineId: AcquisitionPipelineId; sequence: AcquisitionOfferSequence; route: InvestmentOpportunityRoute; status: AcquisitionOfferStatus; sourceAnalysis: OfferSourceAnalysisReference; terms: AcquisitionOfferTerms; createdBy: AcquisitionActorReference; createdAt: Date; submittedAt?: Date; current: boolean; replacesOfferId?: AcquisitionOfferId }>;
export function createAcquisitionOfferSequence(value: number): AcquisitionOfferSequence { if (!Number.isInteger(value) || value < 1) throw new Error("INVALID_ACQUISITION_OFFER_SEQUENCE"); return Object.freeze({ value }); }
