import type {
  LearningConfidence, LearningReference, LessonMaturity, OrganizationalLesson,
} from ".";

export type CalibrationDirection = "increase-confidence" | "maintain-confidence" |
  "reduce-confidence" | "needs-review";
export type CalibrationStatus = "pending" | "approved" | "rejected" | "failed" | "superseded";
export type LearningCalibration = Readonly<{
  id: string; workspaceId: string; lessonId: string; lessonSeriesId: string;
  lessonRevision: number; direction: CalibrationDirection; status: CalibrationStatus;
  previousConfidence: LearningConfidence; proposedConfidence: LearningConfidence;
  previousMaturity: LessonMaturity; proposedMaturity: LessonMaturity;
  reason: string; evidence: readonly LearningReference[];
  reviewedByProfileId: string; policyVersion: string;
  createdAt: string; reviewedAt?: string; supersedesCalibrationId?: string;
}>;
export type CalibrationPolicy = Readonly<{
  version: string; minimumEvidenceCount: number; minimumReviewCount: number;
  allowConfidenceIncreaseBy: number; allowMaturityIncreaseBy: number;
}>;
export type LearningGovernanceEvent = Readonly<{
  id: string; type: "CalibrationRequested" | "CalibrationApproved" |
  "CalibrationRejected" | "ConfidenceChanged" | "MaturityChanged" |
  "GovernanceReviewCompleted" | "LearningRetryRequested";
  workspaceId: string; aggregateId: string; occurredAt: string;
  references: Readonly<Record<string,string>>;
}>;

export class LearningCalibrationError extends Error {
  constructor(readonly code: "calibration_invalid" | "calibration_policy_failed" |
    "calibration_transition_invalid" | "calibration_evidence_required" |
    "calibration_permission_denied" | "calibration_workspace_mismatch", message: string) {
    super(message); this.name="LearningCalibrationError"; Object.freeze(this);
  }
}
const confidenceOrder:readonly LearningConfidence[]=["insufficient-evidence","low","moderate","high"];
const maturityOrder:readonly LessonMaturity[]=["emerging","supported","established","well-validated"];
export const learningCalibrationPolicyV1:CalibrationPolicy=Object.freeze({
  version:"learning-calibration-v1",minimumEvidenceCount:1,minimumReviewCount:1,
  allowConfidenceIncreaseBy:1,allowMaturityIncreaseBy:1,
});

export function createLearningCalibration(input: LearningCalibration,
  lesson: OrganizationalLesson, policy: CalibrationPolicy=learningCalibrationPolicyV1):
Readonly<{calibration:LearningCalibration;event:LearningGovernanceEvent}> {
  if(input.workspaceId!==lesson.workspaceId||input.lessonId!==lesson.id||
    input.lessonSeriesId!==lesson.seriesId||input.lessonRevision!==lesson.revision)
    throw new LearningCalibrationError("calibration_workspace_mismatch","Calibration must reference the exact authorized lesson revision.");
  if(input.status!=="pending"||!input.reason.trim()||!input.reviewedByProfileId||input.policyVersion!==policy.version)
    throw new LearningCalibrationError("calibration_invalid","Calibration requires a pending state, rationale, reviewer, and current policy.");
  if(input.evidence.length<policy.minimumEvidenceCount||lesson.sourceReviewIds.length<policy.minimumReviewCount)
    throw new LearningCalibrationError("calibration_evidence_required","Calibration requires governed evidence and supporting reviews.");
  if(input.previousConfidence!==lesson.confidence||input.previousMaturity!==lesson.maturity)
    throw new LearningCalibrationError("calibration_invalid","Calibration previous values must match the immutable lesson revision.");
  const confidenceChange=index(confidenceOrder,input.proposedConfidence)-index(confidenceOrder,input.previousConfidence);
  const maturityChange=index(maturityOrder,input.proposedMaturity)-index(maturityOrder,input.previousMaturity);
  if(confidenceChange>policy.allowConfidenceIncreaseBy||maturityChange>policy.allowMaturityIncreaseBy)
    throw new LearningCalibrationError("calibration_policy_failed","Calibration may advance only one governed level per review.");
  if(input.direction==="increase-confidence"&&confidenceChange<=0||
    input.direction==="reduce-confidence"&&confidenceChange>=0||
    input.direction==="maintain-confidence"&&confidenceChange!==0)
    throw new LearningCalibrationError("calibration_invalid","Calibration direction does not match the proposed confidence.");
  return freeze({calibration:input,event:event("CalibrationRequested",input.workspaceId,input.id,input.createdAt,{lessonId:lesson.id})});
}

export function approveLearningCalibration(calibration:LearningCalibration,input:{
  approvedByProfileId:string;approvedAt:string;authorized:boolean;
}):Readonly<{calibration:LearningCalibration;events:readonly LearningGovernanceEvent[]}>{
  if(!input.authorized)throw new LearningCalibrationError("calibration_permission_denied","Calibration approval permission is required.");
  if(calibration.status!=="pending")throw new LearningCalibrationError("calibration_transition_invalid","Only pending calibration may be approved.");
  const approved=freeze({...calibration,id:`${calibration.id}:approved:${input.approvedAt}`,
    status:"approved"as const,supersedesCalibrationId:calibration.id,
    reviewedByProfileId:input.approvedByProfileId,reviewedAt:input.approvedAt});
  const events:LearningGovernanceEvent[]=[event("CalibrationApproved",calibration.workspaceId,calibration.id,input.approvedAt,{lessonId:calibration.lessonId})];
  if(calibration.previousConfidence!==calibration.proposedConfidence)events.push(event("ConfidenceChanged",calibration.workspaceId,calibration.lessonSeriesId,input.approvedAt,{previous:calibration.previousConfidence,next:calibration.proposedConfidence}));
  if(calibration.previousMaturity!==calibration.proposedMaturity)events.push(event("MaturityChanged",calibration.workspaceId,calibration.lessonSeriesId,input.approvedAt,{previous:calibration.previousMaturity,next:calibration.proposedMaturity}));
  return freeze({calibration:approved,events:freeze(events)});
}

export function applyCalibrationToLesson(calibration:LearningCalibration,lesson:OrganizationalLesson,
  input:{newLessonId:string;approvedByProfileId:string;approvedAt:string;authorized:boolean}):
Readonly<{calibration:LearningCalibration;lesson:OrganizationalLesson;events:readonly LearningGovernanceEvent[]}>{
  const approved=approveLearningCalibration(calibration,input);
  if(lesson.id!==calibration.lessonId||lesson.workspaceId!==calibration.workspaceId)
    throw new LearningCalibrationError("calibration_workspace_mismatch","Calibration and lesson do not match.");
  return freeze({calibration:approved.calibration,lesson:freeze({...lesson,id:input.newLessonId,
    revision:lesson.revision+1,confidence:calibration.proposedConfidence,maturity:calibration.proposedMaturity,
    supersedesLessonId:lesson.id,policyVersion:calibration.policyVersion,
    createdByProfileId:input.approvedByProfileId,createdAt:input.approvedAt}),events:approved.events});
}
function index<T>(values:readonly T[],value:T){return values.indexOf(value)}
function event(type:LearningGovernanceEvent["type"],workspaceId:string,aggregateId:string,
occurredAt:string,references:Record<string,string>):LearningGovernanceEvent{return freeze({id:`${type}:${aggregateId}:${occurredAt}`,type,workspaceId,aggregateId,occurredAt,references:freeze(references)})}
function freeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(freeze)}return value}
