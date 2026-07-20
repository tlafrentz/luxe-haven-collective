import type { ClaimCollection } from "@/platform/claims";
import type { EvaluationCollection } from "@/platform/evaluations";
import type { EvidenceCollection } from "@/platform/evidence";
import type { ObservationCollection } from "@/platform/observations";
import type { RecommendationCollection } from "@/platform/recommendations";

export type RevenueReasoningArtifacts = Readonly<{ observations: ObservationCollection; evidence: EvidenceCollection; claims: ClaimCollection; evaluations: EvaluationCollection; recommendations: RecommendationCollection }>;
