import type{LearningAssumptionResult,LearningDomainEvent,LearningEvidence,LearningLesson,LearningLineageEdge,LearningMeasurementPlan,LearningOutcomeReview,LearningSubject,MeasuredOutcome}from"../domain";import type{PlatformLearningRepository}from"../application";
export class InMemoryPlatformLearningRepository implements PlatformLearningRepository{readonly subjects=new Map<string,LearningSubject>();readonly lineage:LearningLineageEdge[]=[];readonly evidence:LearningEvidence[]=[];readonly plans:LearningMeasurementPlan[]=[];readonly measurements:MeasuredOutcome[]=[];readonly reviews:LearningOutcomeReview[]=[];readonly assumptions:LearningAssumptionResult[]=[];readonly lessons:LearningLesson[]=[];readonly events:LearningDomainEvent[]=[];
 async createSubject(subject:LearningSubject){if(this.subjects.has(subject.id))throw new Error("learning_idempotency_conflict");this.subjects.set(subject.id,subject)}
 async appendLineage(edge:LearningLineageEdge){this.lineage.push(edge)}
 async appendEvidence(evidence:LearningEvidence){this.evidence.push(evidence)}
 async appendMeasurementPlan(plan:LearningMeasurementPlan){this.plans.push(plan)}
 async appendMeasuredOutcome(outcome:MeasuredOutcome){this.measurements.push(outcome)}
 async appendOutcomeReview(review:LearningOutcomeReview){this.reviews.push(review)}
 async appendAssumptionResult(result:LearningAssumptionResult){this.assumptions.push(result)}
 async appendLesson(lesson:LearningLesson){this.lessons.push(lesson)}
 async appendEvents(events:readonly LearningDomainEvent[]){this.events.push(...events)}
 async getSubject(workspaceId:string,id:string){const value=this.subjects.get(id);return value?.workspaceId===workspaceId?value:null}
 async getOutcomeReview(workspaceId:string,id:string){return this.reviews.find(value=>value.id===id&&value.workspaceId===workspaceId)??null}
 async getLesson(workspaceId:string,id:string){return this.lessons.find(value=>value.id===id&&value.workspaceId===workspaceId)??null}
}
