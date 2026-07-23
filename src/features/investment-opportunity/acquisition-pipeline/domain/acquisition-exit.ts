import type { InvestmentOpportunityRoute } from "@/features/investment-opportunity/domain";
import type { AcquisitionActorReference } from "./acquisition-actor-reference";
import type { AcquisitionStage } from "./acquisition-stage";
import { isTerminalAcquisitionStage } from "./acquisition-stage";
import { AcquisitionDomainError } from "./errors";

export const ACQUISITION_EXIT_REASONS = ["offer-rejected", "terms-unacceptable", "inspection-failed", "financing-failed", "appraisal-failed", "title-or-legal", "regulatory-ineligible", "landlord-declined", "economics-deteriorated", "operator-withdrew", "counterparty-withdrew", "opportunity-unavailable", "other"] as const;
export type AcquisitionExitReason = (typeof ACQUISITION_EXIT_REASONS)[number];
export type AcquisitionReconsideration = Readonly<{ eligible: false } | { eligible: true; notBefore?: Date; note?: string }>;
export type AcquisitionExit = Readonly<{ reason: AcquisitionExitReason; explanation?: string; exitedFromStage: Exclude<AcquisitionStage, "closed-acquired" | "exited">; exitedAt: Date; exitedBy: AcquisitionActorReference; reconsideration: AcquisitionReconsideration }>;
export function isAcquisitionExitReason(value: unknown): value is AcquisitionExitReason { return typeof value === "string" && (ACQUISITION_EXIT_REASONS as readonly string[]).includes(value); }
export function isAcquisitionExitReasonApplicable(route: InvestmentOpportunityRoute, reason: AcquisitionExitReason): boolean { if (reason === "appraisal-failed" || reason === "financing-failed" || reason === "title-or-legal") return route === "purchase"; if (reason === "landlord-declined") return route === "rental-arbitrage"; return true; }
export function createAcquisitionExit(input: AcquisitionExit & Readonly<{ route: InvestmentOpportunityRoute }>): AcquisitionExit {
  const explanation = input.explanation?.trim();
  const notBefore = input.reconsideration.eligible ? input.reconsideration.notBefore : undefined;
  if (!isAcquisitionExitReason(input.reason)) throw new AcquisitionDomainError("INVALID_ACQUISITION_EXIT_REASON");
  if (isTerminalAcquisitionStage(input.exitedFromStage)) throw new AcquisitionDomainError("INVALID_ACQUISITION_EXIT", { stage: input.exitedFromStage });
  if (!isAcquisitionExitReasonApplicable(input.route, input.reason)) throw new AcquisitionDomainError("ACQUISITION_EXIT_REASON_NOT_APPLICABLE", { route: input.route, reason: input.reason });
  if (input.reason === "other" && !explanation) throw new AcquisitionDomainError("ACQUISITION_EXIT_EXPLANATION_REQUIRED");
  if (!(input.exitedAt instanceof Date) || Number.isNaN(input.exitedAt.getTime()) || notBefore && notBefore.getTime() < input.exitedAt.getTime()) throw new AcquisitionDomainError("INVALID_ACQUISITION_EXIT");
  return Object.freeze({ reason: input.reason, ...(explanation ? { explanation } : {}), exitedFromStage: input.exitedFromStage, exitedAt: new Date(input.exitedAt), exitedBy: Object.freeze({ ...input.exitedBy }), reconsideration: Object.freeze({ ...input.reconsideration, ...(notBefore ? { notBefore: new Date(notBefore) } : {}) }) });
}
