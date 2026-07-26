import type { LearningCalibration, LearningConfidence, LessonMaturity } from "../domain";

export type LearningOperationalJob=Readonly<{id:string;workspaceId:string;type:"measurement-retry"|"review-retry"|"calibration-retry";aggregateId:string;status:"queued"|"processing"|"completed"|"failed"|"cancelled";attempts:number;failureCode?:string;createdAt:string;leaseExpiresAt?:string}>;
export type LearningAlert=Readonly<{id:string;severity:"critical"|"high"|"medium"|"low";type:"review-backlog"|"evidence-quality"|"contradiction-rate"|"measurement-failure"|"calibration-overdue"|"coverage-decline";summary:string;metric:number;threshold:number;policyVersion:string}>;
export type LearningAdministrationInput=Readonly<{
  reviews:readonly Readonly<{id:string;status:string;createdAt:string;completedAt?:string;evidenceCount:number}>[];
  lessons:readonly Readonly<{id:string;category:string;status:string;confidence:LearningConfidence;maturity:LessonMaturity;evidenceCount:number;createdAt:string}>[];
  candidates:readonly Readonly<{id:string;createdAt:string}>[];
  contradictions:readonly Readonly<{id:string;state:string;createdAt:string}>[];
  calibrations:readonly LearningCalibration[];
  measurementJobs:readonly Readonly<{id:string;workspaceId:string;status:string;attempts:number;failureCode?:string;createdAt:string}>[];
  governanceJobs:readonly LearningOperationalJob[];evaluatedAt:string;
}>;
export type LearningAdministration=Readonly<{
  health:Readonly<{score:number;status:"healthy"|"developing"|"attention";reviewCompletion:number;
    evidenceCoverage:number;contradictionRate:number;averageConfidence:number;averageMaturity:number;
    knowledgeGrowth:number;reviewLatencyDays:number;calibrationActivity:number}>;
  coverage:readonly Readonly<{category:string;validatedLessons:number;evidenceCount:number;strength:"strong"|"developing"|"gap"}>[];
  queues:Readonly<{pendingReviews:number;candidateLessons:number;calibrationReviews:number;
    contradictions:number;retryJobs:number;failedJobs:number}>;
  distributions:Readonly<{confidence:Readonly<Record<LearningConfidence,number>>;
    maturity:Readonly<Record<LessonMaturity,number>>}>;
  alerts:readonly LearningAlert[];jobs:readonly LearningOperationalJob[];
  calibrations:readonly LearningCalibration[];evaluatedAt:string;policyVersion:string;
}>;
export const learningHealthPolicyV1=Object.freeze({version:"learning-health-v1",reviewBacklog:10,
  minimumEvidenceCoverage:.7,maximumContradictionRate:.2,maximumFailedJobs:2,
  calibrationOverdueDays:30,minimumCategoryCoverage:1});
const categories=["investment","revenue","financial","capital","operations","guest-experience","portfolio"]as const;
const confidenceWeight:Record<LearningConfidence,number>={"insufficient-evidence":0,low:1,moderate:2,high:3};
const maturityWeight:Record<LessonMaturity,number>={emerging:0,supported:1,established:2,"well-validated":3};

export function getLearningAdministration(input:LearningAdministrationInput):LearningAdministration{
  const completed=input.reviews.filter(x=>["completed","unable-to-evaluate"].includes(x.status)),validated=input.lessons.filter(x=>x.status==="validated"),
    evidenceCoverage=ratio(validated.filter(x=>x.evidenceCount>0).length,validated.length),
    reviewCompletion=ratio(completed.length,input.reviews.length),
    contradictionRate=ratio(input.contradictions.length,validated.length),
    averageConfidence=average(validated.map(x=>confidenceWeight[x.confidence]/3)),
    averageMaturity=average(validated.map(x=>maturityWeight[x.maturity]/3)),
    recent=validated.filter(x=>days(x.createdAt,input.evaluatedAt)<=90).length,
    prior=validated.filter(x=>{const age=days(x.createdAt,input.evaluatedAt);return age>90&&age<=180}).length,
    growth=recent-prior,latency=average(completed.filter(x=>x.completedAt).map(x=>days(x.createdAt,x.completedAt!))),
    score=Math.round(100*clamp(reviewCompletion*.2+evidenceCoverage*.25+(1-contradictionRate)*.15+
      averageConfidence*.15+averageMaturity*.15+Math.min(1,validated.length/10)*.1));
  const health=Object.freeze({score,status:score>=75?"healthy"as const:score>=45?"developing"as const:"attention"as const,
    reviewCompletion,evidenceCoverage,contradictionRate,averageConfidence,averageMaturity,
    knowledgeGrowth:growth,reviewLatencyDays:latency,calibrationActivity:input.calibrations.length});
  const coverage=Object.freeze(categories.map(category=>{const lessons=validated.filter(x=>x.category===category),
    evidenceCount=lessons.reduce((sum,x)=>sum+x.evidenceCount,0);return Object.freeze({category,
      validatedLessons:lessons.length,evidenceCount,strength:lessons.length>=3&&evidenceCount>=6?"strong"as const:
      lessons.length?"developing"as const:"gap"as const})}));
  const measurementRetries:LearningOperationalJob[]=input.measurementJobs.filter(x=>x.status==="failed").map(x=>Object.freeze({
    id:`measurement-retry:${x.id}`,workspaceId:x.workspaceId,type:"measurement-retry"as const,aggregateId:x.id,
    status:"failed"as const,attempts:x.attempts,...(x.failureCode?{failureCode:x.failureCode}:{}),createdAt:x.createdAt}));
  const jobs=Object.freeze([...input.governanceJobs,...measurementRetries]);
  const queues=Object.freeze({pendingReviews:input.reviews.filter(x=>!["completed","unable-to-evaluate","cancelled","superseded"].includes(x.status)).length,
    candidateLessons:input.candidates.length,calibrationReviews:input.calibrations.filter(x=>x.status==="pending").length,
    contradictions:input.contradictions.filter(x=>x.state!=="none").length,retryJobs:jobs.filter(x=>x.status==="queued").length,
    failedJobs:jobs.filter(x=>x.status==="failed").length});
  const distributions=Object.freeze({confidence:distribution(validated.map(x=>x.confidence),["high","moderate","low","insufficient-evidence"]),
    maturity:distribution(validated.map(x=>x.maturity),["emerging","supported","established","well-validated"])});
  return Object.freeze({health,coverage,queues,distributions,
    alerts:buildLearningAlerts({health,queues,coverage,calibrations:input.calibrations,evaluatedAt:input.evaluatedAt}),
    jobs,calibrations:Object.freeze([...input.calibrations]),evaluatedAt:input.evaluatedAt,policyVersion:learningHealthPolicyV1.version});
}
export function buildLearningAlerts(input:{health:LearningAdministration["health"];queues:LearningAdministration["queues"];coverage:LearningAdministration["coverage"];calibrations:readonly LearningCalibration[];evaluatedAt:string}):readonly LearningAlert[]{
  const alerts:LearningAlert[]=[];const add=(type:LearningAlert["type"],severity:LearningAlert["severity"],summary:string,metric:number,threshold:number)=>alerts.push(Object.freeze({id:`${type}:${input.evaluatedAt}`,type,severity,summary,metric,threshold,policyVersion:learningHealthPolicyV1.version}));
  if(input.queues.pendingReviews>learningHealthPolicyV1.reviewBacklog)add("review-backlog","high","Outcome-review backlog exceeds policy.",input.queues.pendingReviews,learningHealthPolicyV1.reviewBacklog);
  if(input.health.evidenceCoverage<learningHealthPolicyV1.minimumEvidenceCoverage)add("evidence-quality","high","Evidence coverage is below policy.",input.health.evidenceCoverage,learningHealthPolicyV1.minimumEvidenceCoverage);
  if(input.health.contradictionRate>learningHealthPolicyV1.maximumContradictionRate)add("contradiction-rate","medium","Contradiction rate requires governance review.",input.health.contradictionRate,learningHealthPolicyV1.maximumContradictionRate);
  if(input.queues.failedJobs>learningHealthPolicyV1.maximumFailedJobs)add("measurement-failure","critical","Repeated Learning jobs are failing.",input.queues.failedJobs,learningHealthPolicyV1.maximumFailedJobs);
  const overdue=input.calibrations.filter(x=>x.status==="pending"&&days(x.createdAt,input.evaluatedAt)>learningHealthPolicyV1.calibrationOverdueDays).length;
  if(overdue)add("calibration-overdue","medium","Calibration reviews are overdue.",overdue,0);
  const gaps=input.coverage.filter(x=>x.strength==="gap").length;if(gaps)add("coverage-decline","low","Some knowledge domains have no validated coverage.",gaps,0);
  return Object.freeze(alerts);
}
export function requestSafeLearningRetry(job:LearningOperationalJob,input:{id:string;requestedAt:string;authorized:boolean;retryableCodes:readonly string[]}):LearningOperationalJob{
  if(!input.authorized)throw new Error("learning_permission_denied");
  if(job.status!=="failed"||job.failureCode&&!input.retryableCodes.includes(job.failureCode))throw new Error("learning_retry_not_safe");
  return Object.freeze({...job,id:input.id,status:"queued",attempts:job.attempts,createdAt:input.requestedAt});
}
function distribution<T extends string>(values:readonly T[],keys:readonly T[]){return Object.freeze(Object.fromEntries(keys.map(key=>[key,values.filter(x=>x===key).length]))as Record<T,number>)}
function ratio(a:number,b:number){return b?a/b:0}function average(v:readonly number[]){return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function clamp(v:number){return Math.max(0,Math.min(1,v))}function days(a:string,b:string){return Math.abs(Date.parse(b)-Date.parse(a))/86400000}
