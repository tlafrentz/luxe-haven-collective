import type { ClaimCollection } from "@/platform/claims";
import type { Action } from "@/platform/actions";
import type { Decision } from "@/platform/decisions";
import type { EvaluationCollection } from "@/platform/evaluations";
import type { EvidenceCollection } from "@/platform/evidence";
import type { IntelligenceReport } from "@/platform/intelligence";
import type { ObservationCollection } from "@/platform/observations";
import type { Outcome } from "@/platform/outcomes";
import type { RecommendationCollection } from "@/platform/recommendations";

export type MarketPlatformArtifacts = Readonly<{ observations: ObservationCollection; evidence: EvidenceCollection; claims: ClaimCollection; evaluations: EvaluationCollection; recommendations: RecommendationCollection; decision: Decision<"analyze">; action: Action; outcome: Outcome; intelligence: IntelligenceReport }>;
