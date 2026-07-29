import type { CanonicalLearningCandidate,CanonicalLearningReview,ValidatedLearningArtifact } from "../domain";
import { generateCanonicalLearningCandidate,scheduleCanonicalLearningReview,validateCanonicalLearning } from "./canonical-learning-engine";

export interface CanonicalLearningRepository{
  appendCandidate(value:CanonicalLearningCandidate):Promise<void>;
  appendReview(value:CanonicalLearningReview):Promise<void>;
  appendValidatedLearning(value:ValidatedLearningArtifact):Promise<void>;
  getValidatedLearning(workspaceId:string,id:string):Promise<ValidatedLearningArtifact|null>;
}
export async function generateCandidateFromMeasuredOutcome(repository:CanonicalLearningRepository,input:Parameters<typeof generateCanonicalLearningCandidate>[0]){
  const candidate=generateCanonicalLearningCandidate(input);await repository.appendCandidate(candidate);return candidate;
}
export async function scheduleLearningValidation(repository:CanonicalLearningRepository,candidate:CanonicalLearningCandidate,input:Parameters<typeof scheduleCanonicalLearningReview>[1]){
  const review=scheduleCanonicalLearningReview(candidate,input);await repository.appendReview(review);return review;
}
export async function publishValidatedLearning(repository:CanonicalLearningRepository,candidate:CanonicalLearningCandidate,review:CanonicalLearningReview,input:Omit<Parameters<typeof validateCanonicalLearning>[2],"previous">&{previousLearningId?:string}){
  const previous=input.previousLearningId?await repository.getValidatedLearning(candidate.workspaceId,input.previousLearningId):undefined;
  if(input.previousLearningId&&!previous)throw new Error("LEARNING_VERSION_NOT_FOUND");
  const learning=validateCanonicalLearning(candidate,review,{...input,previous:previous??undefined});await repository.appendValidatedLearning(learning);return learning;
}
