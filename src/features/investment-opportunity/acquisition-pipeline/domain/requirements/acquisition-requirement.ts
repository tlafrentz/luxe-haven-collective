import type { ActionId } from "@/platform/actions";
import type { EvidenceId } from "@/platform/evidence";
import type { AcquisitionActorReference } from "../acquisition-actor-reference";
import { AcquisitionDomainError } from "../errors";
export const ACQUISITION_REQUIREMENT_STATUSES = ["not-started", "in-progress", "satisfied", "waived", "failed", "not-applicable"] as const;
export type AcquisitionRequirementStatus = (typeof ACQUISITION_REQUIREMENT_STATUSES)[number];
export type AcquisitionRequirementPriority = "low" | "normal" | "high" | "critical";
export type AcquisitionRequirementWaiver = Readonly<{ reasonCode: "operator-risk-acceptance" | "contract-amendment" | "alternative-evidence" | "counterparty-resolution" | "deadline-expired" | "not-material" | "other"; explanation: string; riskAcknowledged: boolean; waivedAt: Date; waivedBy: AcquisitionActorReference }>;
export type AcquisitionActionReference = Readonly<{ actionId: ActionId; relationship: "executes-requirement" | "supports-requirement" | "resolves-blocker" }>;
export type AcquisitionEvidenceReference = Readonly<{ evidenceId: EvidenceId; relationship: "supports" | "contradicts" | "documents" | "verifies" }>;
export type AcquisitionDocumentReference = Readonly<{ documentId: string; relationship: "agreement" | "inspection" | "authorization" | "report" | "supporting-document" | "other" }>;
export type AcquisitionConcern = Readonly<{ code?: string; title: string; summary: string; severity: "low" | "moderate" | "high" | "critical"; blocking: boolean; evidenceReferences: readonly AcquisitionEvidenceReference[] }>;
export type AcquisitionRequirementOutcome = Readonly<{ status: Exclude<AcquisitionRequirementStatus, "not-started" | "in-progress">; explanation?: string; waiver?: AcquisitionRequirementWaiver; concerns?: readonly AcquisitionConcern[]; recordedAt: Date; recordedBy: AcquisitionActorReference }>;
export function validateWaiver(waiver: AcquisitionRequirementWaiver): void { if (!waiver.explanation.trim() || !waiver.riskAcknowledged || Number.isNaN(waiver.waivedAt.getTime())) throw new AcquisitionDomainError("ACQUISITION_REQUIREMENT_WAIVER_INVALID"); }
export function validateConcern(concern: AcquisitionConcern): void { if (!concern.title.trim() || !concern.summary.trim()) throw new AcquisitionDomainError("ACQUISITION_REQUIREMENT_OUTCOME_INVALID"); }
