import type { InvestmentOpportunityRoute } from "@/features/investment-opportunity/domain";
import type { AcquisitionStage } from "../acquisition-stage";
import type { AcquisitionRequirementPriority } from "../requirements";
export type AcquisitionRequirementTemplate = Readonly<{ key: string; version: number; route: InvestmentOpportunityRoute; category: string; title: string; description: string; requirementType: "contingency" | "due-diligence"; defaultBlocking: boolean; defaultPriority: AcquisitionRequirementPriority; suggestedStage: AcquisitionStage; waiverPolicy?: "allowed" | "prohibited"; evidenceGuidance?: string }>;
