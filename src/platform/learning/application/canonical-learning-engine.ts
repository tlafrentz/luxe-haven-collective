import type {
  CanonicalLearningCandidate,CanonicalLearningConfidence,CanonicalLearningReview,LearningConfidenceFactors,
  LearningGuidanceProjection,LearningLineage,ValidatedLearningArtifact,
} from "../domain";

export function calculateCanonicalLearningConfidence(factors:LearningConfidenceFactors):CanonicalLearningConfidence{
  const evidence=Math.min(1,factors.observationCount/10),consistency=Math.min(1,factors.consistentOutcomeCount/5);
  const sample=Math.min(1,factors.sampleSize/30),horizon=Math.min(1,factors.timeHorizonDays/365);
  const impact=Math.min(1,Math.max(0,factors.businessImpact)/100),quality=Math.min(1,Math.max(0,factors.dataQuality));
  const recency=Math.max(0,1-factors.recencyDays/730),contradictions=Math.min(.5,factors.contradictionCount*.15);
  const score=Math.round(100*Math.max(0,Math.min(1,evidence*.15+consistency*.2+sample*.15+horizon*.1+impact*.1+quality*.2+recency*.1-contradictions)));
  return Object.freeze({score,level:score>=80?"high":score>=55?"moderate":score>=30?"low":"insufficient-evidence",factors:Object.freeze({...factors}),policyVersion:"learning-confidence.v1"});
}
export function generateCanonicalLearningCandidate(input:Omit<CanonicalLearningCandidate,"id"|"confidence"|"validationStatus"|"policyVersion">&{confidenceFactors:LearningConfidenceFactors}):CanonicalLearningCandidate{
  requireCompleteLineage(input.lineage);if(!input.statement.trim()||!input.applicability.length)throw new Error("LEARNING_CANDIDATE_INVALID");
  const fingerprintValue=[input.workspaceId,input.seriesId,input.statement,...allReferences(input.lineage).map(item=>`${item.type}:${item.sourceId}`)].join("|");
  return Object.freeze({...input,id:`learning-candidate-${fingerprint(fingerprintValue)}`,confidence:calculateCanonicalLearningConfidence(input.confidenceFactors),
    validationStatus:"proposed",policyVersion:"learning-candidate.v1"});
}
export function scheduleCanonicalLearningReview(candidate:CanonicalLearningCandidate,input:{id:string;scheduledAt:string;reviewerProfileId?:string}):CanonicalLearningReview{
  return Object.freeze({id:input.id,workspaceId:candidate.workspaceId,candidateId:candidate.id,status:"scheduled",reviewerProfileId:input.reviewerProfileId??null,
    decision:null,evidence:Object.freeze(allReferences(candidate.lineage)),outcomeReferences:candidate.lineage.outcomes,confidence:candidate.confidence,scheduledAt:input.scheduledAt});
}
export function beginCanonicalLearningReview(review:CanonicalLearningReview,reviewerProfileId:string):CanonicalLearningReview{
  if(review.status!=="scheduled"||!reviewerProfileId)throw new Error("LEARNING_REVIEW_TRANSITION_INVALID");
  return Object.freeze({...review,status:"in-review",reviewerProfileId});
}
export function validateCanonicalLearning(candidate:CanonicalLearningCandidate,review:CanonicalLearningReview,input:{id:string;statement?:string;futureGuidance:string;reviewerProfileId:string;validatedAt:string;previous?:ValidatedLearningArtifact}):ValidatedLearningArtifact{
  requireCompleteLineage(candidate.lineage);
  if(review.candidateId!==candidate.id||review.workspaceId!==candidate.workspaceId||!input.reviewerProfileId||!input.futureGuidance.trim())throw new Error("LEARNING_VALIDATION_INVALID");
  if(review.status!=="in-review")throw new Error("LEARNING_REVIEW_NOT_ACTIVE");
  if(!review.outcomeReferences.length)throw new Error("LEARNING_MEASURABLE_OUTCOME_REQUIRED");
  if(input.previous&&(input.previous.workspaceId!==candidate.workspaceId||input.previous.seriesId!==candidate.seriesId))throw new Error("LEARNING_VERSION_CONFLICT");
  return Object.freeze({id:input.id,workspaceId:candidate.workspaceId,seriesId:candidate.seriesId,version:(input.previous?.version??0)+1,category:candidate.category,
    statement:input.statement?.trim()||candidate.statement,futureGuidance:input.futureGuidance,applicability:candidate.applicability,lineage:candidate.lineage,
    confidence:candidate.confidence,status:"validated",...(input.previous?{supersedesLearningId:input.previous.id}:{}),validatedByProfileId:input.reviewerProfileId,
    validatedAt:input.validatedAt,policyVersion:"validated-learning.v1"});
}
export function buildLearningGuidanceProjection(capability:LearningGuidanceProjection["capability"],lessons:readonly ValidatedLearningArtifact[],generatedAt:string):LearningGuidanceProjection{
  const applicable=lessons.filter(item=>item.status==="validated"&&categoryMatches(item.category,capability)).sort((a,b)=>b.confidence.score-a.confidence.score||b.version-a.version||a.id.localeCompare(b.id));
  return Object.freeze({capability,generatedAt,guidance:Object.freeze(applicable.map(item=>Object.freeze({learningId:item.id,learningVersion:item.version,statement:item.statement,
    futureGuidance:item.futureGuidance,confidence:item.confidence.level,applicability:item.applicability})))});
}
export function requireCompleteLineage(lineage:LearningLineage){
  if(!lineage.observations.length)throw new Error("LEARNING_OBSERVATION_REQUIRED");
  if(!lineage.decisions.length)throw new Error("LEARNING_DECISION_REQUIRED");
  if(!lineage.actions.length)throw new Error("LEARNING_EXECUTION_REQUIRED");
  if(!lineage.outcomes.length)throw new Error("LEARNING_MEASURABLE_OUTCOME_REQUIRED");
  if(!lineage.reviews.length)throw new Error("LEARNING_REVIEW_REQUIRED");
}
function allReferences(lineage:LearningLineage){return[...lineage.observations,...lineage.decisions,...lineage.actions,...lineage.outcomes,...lineage.reviews]}
function categoryMatches(category:ValidatedLearningArtifact["category"],capability:LearningGuidanceProjection["capability"]){return capability==="executive"||capability==="portfolio"||category===capability}
function fingerprint(value:string){let hash=2166136261;for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619);return(hash>>>0).toString(16).padStart(8,"0")}
