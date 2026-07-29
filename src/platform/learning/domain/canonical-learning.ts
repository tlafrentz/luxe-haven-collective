import type { LearningConfidence,LearningReference } from "./learning-lineage";
import type { LessonApplicabilityRule } from "./lesson-knowledge";

export type CanonicalLearningCategory="investment"|"revenue"|"financial"|"guest-experience"|"operations"|"market"|"portfolio";
export type LearningValidationStatus="proposed"|"scheduled"|"in-review"|"validated"|"rejected"|"unable-to-evaluate";
export type LearningLineage=Readonly<{
  observations:readonly LearningReference[];decisions:readonly LearningReference[];actions:readonly LearningReference[];
  outcomes:readonly LearningReference[];reviews:readonly LearningReference[];
}>;
export type LearningConfidenceFactors=Readonly<{
  observationCount:number;consistentOutcomeCount:number;sampleSize:number;timeHorizonDays:number;
  businessImpact:number;dataQuality:number;recencyDays:number;contradictionCount:number;
}>;
export type CanonicalLearningConfidence=Readonly<{score:number;level:LearningConfidence;factors:LearningConfidenceFactors;policyVersion:"learning-confidence.v1"}>;
export type CanonicalLearningCandidate=Readonly<{
  id:string;workspaceId:string;seriesId:string;category:CanonicalLearningCategory;statement:string;
  applicability:readonly LessonApplicabilityRule[];lineage:LearningLineage;confidence:CanonicalLearningConfidence;
  validationStatus:"proposed"|"scheduled"|"in-review";createdAt:string;policyVersion:"learning-candidate.v1";
}>;
export type ValidatedLearningArtifact=Readonly<{
  id:string;workspaceId:string;seriesId:string;version:number;category:CanonicalLearningCategory;statement:string;
  futureGuidance:string;applicability:readonly LessonApplicabilityRule[];lineage:LearningLineage;
  confidence:CanonicalLearningConfidence;status:"validated"|"retired"|"contradicted";
  supersedesLearningId?:string;validatedByProfileId:string;validatedAt:string;policyVersion:"validated-learning.v1";
}>;
export type CanonicalLearningReview=Readonly<{
  id:string;workspaceId:string;candidateId:string;status:LearningValidationStatus;reviewerProfileId:string|null;
  decision:string|null;evidence:readonly LearningReference[];outcomeReferences:readonly LearningReference[];
  confidence:CanonicalLearningConfidence;scheduledAt:string;completedAt?:string;
}>;
export type LearningGuidanceProjection=Readonly<{
  capability:"investment"|"revenue"|"financial"|"executive"|"portfolio";generatedAt:string;
  guidance:readonly Readonly<{learningId:string;learningVersion:number;statement:string;futureGuidance:string;confidence:LearningConfidence;applicability:readonly LessonApplicabilityRule[]}>[];
}>;
