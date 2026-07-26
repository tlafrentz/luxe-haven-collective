import type {
  LearningConfidence, LearningReference, LessonApplicabilityRule, LessonMaturity,
} from "../domain";
import type { LearningWorkspaceLesson } from "./learning-workspace";

export type LearningDecisionContext = Readonly<{
  workspaceId: string;
  capability: "investment" | "revenue" | "capital" | "financial" |
  "portfolio" | "guest-communications" | "guidebook-studio" | "operations";
  subjectType: string; subjectId: string;
  portfolioId?: string; market?: string; propertyId?: string; propertyType?: string;
  strategy?: string; season?: string; guestSegment?: string; operatingModel?: string;
  evaluatedAt: string;
}>;
export type ApplicabilityMatch = "direct" | "strong" | "partial" | "weak" | "not-applicable";
export type LearningSelectionReason = Readonly<{
  code: "workspace-match" | "capability-match" | "direct-context-match" |
  "context-overlap" | "maturity" | "confidence" | "evidence-quality" |
  "fresh-evidence" | "contradiction";
  detail: string; contribution: number;
}>;
export type RelevantLearning = Readonly<{
  lessonId: string; statement: string; relevanceScore: number;
  relevance: "high" | "moderate" | "low"; confidence: LearningConfidence;
  maturity: LessonMaturity; applicability: readonly LessonApplicabilityRule[];
  applicabilityMatch: ApplicabilityMatch; supportingReviewIds: readonly string[];
  supportingEvidence: readonly LearningReference[]; evidenceCount: number;
  contradictionState: LearningWorkspaceLesson["contradictionState"];
  rationale: readonly LearningSelectionReason[];
}>;
export type RelevantLearningProjection = Readonly<{
  context: LearningDecisionContext; lessons: readonly RelevantLearning[];
  confidence: LearningConfidence; evidenceCount: number;
  state: "available" | "none" | "conflicting" | "partial";
  policyVersion: string; evaluatedAt: string;
}>;
export type RelevantLearningPolicy = Readonly<{
  version: string; minimumConfidence: Exclude<LearningConfidence, "insufficient-evidence">;
  minimumMaturity: LessonMaturity; minimumEvidenceCount: number;
  maximumAgeDays: number; resultLimit: number;
}>;
export interface RelevantLearningSourcePort {
  listValidatedLessons(workspaceId: string): Promise<readonly LearningWorkspaceLesson[]>;
  getEvidence(lessonId: string): Promise<readonly LearningReference[]>;
}
export interface RelevantLearningPort {
  resolve(context: LearningDecisionContext): Promise<RelevantLearningProjection>;
}

const confidenceRank: Record<LearningConfidence,number>={ "insufficient-evidence":0,low:1,moderate:2,high:3 };
const maturityRank: Record<LessonMaturity,number>={emerging:0,supported:1,established:2,"well-validated":3};
export const relevantLearningPolicyV1:RelevantLearningPolicy=Object.freeze({
  version:"relevant-learning-v1",minimumConfidence:"low",minimumMaturity:"emerging",
  minimumEvidenceCount:1,maximumAgeDays:730,resultLimit:5,
});

export async function resolveRelevantLearning(source:RelevantLearningSourcePort,
  context:LearningDecisionContext,policy:RelevantLearningPolicy=relevantLearningPolicyV1):
Promise<RelevantLearningProjection>{
  const lessons=await source.listValidatedLessons(context.workspaceId);
  const candidates=lessons.filter(lesson=>lesson.status==="validated"&&
    categoryMatchesCapability(lesson.category,context.capability)&&
    confidenceRank[lesson.confidence]>=confidenceRank[policy.minimumConfidence]&&
    maturityRank[lesson.maturity]>=maturityRank[policy.minimumMaturity]&&
    lesson.evidenceCount>=policy.minimumEvidenceCount&&
    ageDays(lesson.validatedAt,context.evaluatedAt)<=policy.maximumAgeDays);
  const scored=await Promise.all(candidates.map(async (lesson):Promise<RelevantLearning|null>=>{
    const applicability=matchApplicability(lesson.applicability,context);
    if(applicability.state==="not-applicable")return null;
    const evidence=await source.getEvidence(lesson.id);
    const reasons:LearningSelectionReason[]=[
      {code:"workspace-match",detail:"The lesson belongs to the authorized Workspace.",contribution:10},
      {code:"capability-match",detail:`The ${lesson.category} lesson matches the ${context.capability} decision capability.`,contribution:15},
      ...applicability.reasons,
      {code:"maturity",detail:`Maturity is ${lesson.maturity}.`,contribution:maturityRank[lesson.maturity]*6},
      {code:"confidence",detail:`Confidence is ${lesson.confidence}.`,contribution:confidenceRank[lesson.confidence]*7},
      {code:"evidence-quality",detail:`${lesson.evidenceCount} evidence references and ${lesson.sourceReviewIds.length} supporting reviews.`,contribution:Math.min(15,lesson.evidenceCount*3)},
      {code:"fresh-evidence",detail:"The lesson is within the configured freshness window.",contribution:8},
      ...(lesson.contradictionState!=="none"?[{code:"contradiction"as const,detail:`Contradiction state is ${lesson.contradictionState}; operator review is required.`,contribution:-15}]:[]),
    ];
    const score=Math.max(0,Math.min(100,reasons.reduce((sum,x)=>sum+x.contribution,0)));
    return Object.freeze({lessonId:lesson.id,statement:lesson.statement,relevanceScore:score,
      relevance:score>=70?"high"as const:score>=45?"moderate"as const:"low"as const,
      confidence:lesson.confidence,maturity:lesson.maturity,applicability:lesson.applicability,
      applicabilityMatch:applicability.state as Exclude<ApplicabilityMatch,"not-applicable">,supportingReviewIds:lesson.sourceReviewIds,
      supportingEvidence:Object.freeze([...evidence]),evidenceCount:lesson.evidenceCount,
      contradictionState:lesson.contradictionState,rationale:Object.freeze(reasons)});
  }));
  const ranked=scored.filter((item):item is RelevantLearning=>Boolean(item))
    .sort((a,b)=>b.relevanceScore-a.relevanceScore||a.lessonId.localeCompare(b.lessonId))
    .slice(0,policy.resultLimit);
  const conflict=ranked.some(x=>x.contradictionState!=="none");
  return Object.freeze({context,lessons:Object.freeze(ranked),confidence:projectionConfidence(ranked),
    evidenceCount:ranked.reduce((sum,x)=>sum+x.evidenceCount,0),
    state:!ranked.length?"none":conflict?"conflicting":ranked.some(x=>x.relevance==="low")?"partial":"available",
    policyVersion:policy.version,evaluatedAt:context.evaluatedAt});
}

export class LearningResolver implements RelevantLearningPort{
  constructor(private readonly source:RelevantLearningSourcePort,private readonly policy:RelevantLearningPolicy=relevantLearningPolicyV1){}
  resolve(context:LearningDecisionContext){return resolveRelevantLearning(this.source,context,this.policy)}
}
export const rankRelevantLessons=(lessons:readonly RelevantLearning[])=>Object.freeze([...lessons].sort((a,b)=>b.relevanceScore-a.relevanceScore||a.lessonId.localeCompare(b.lessonId)));
export const explainLessonSelection=(lesson:RelevantLearning)=>Object.freeze(lesson.rationale.map(x=>x.detail));

function matchApplicability(rules:readonly LessonApplicabilityRule[],context:LearningDecisionContext):
Readonly<{state:ApplicabilityMatch;reasons:readonly LearningSelectionReason[]}>{
  let matched=0,specific=0,conflict=false;const reasons:LearningSelectionReason[]=[];
  const values:Partial<Record<LessonApplicabilityRule["dimension"],string|undefined>>={
    workspace:context.workspaceId,portfolio:context.portfolioId,market:context.market,
    property:context.propertyId,"property-type":context.propertyType,strategy:context.strategy,
    season:context.season,"guest-segment":context.guestSegment,"operating-model":context.operatingModel};
  for(const rule of rules){const expected=rule.referenceId??rule.value,current=values[rule.dimension];
    if(!expected)continue;if(current&&current===expected){matched++;if(rule.dimension!=="workspace")specific++;reasons.push({code:rule.dimension==="workspace"?"workspace-match":"direct-context-match",detail:`${rule.dimension} directly matches ${expected}.`,contribution:rule.dimension==="workspace"?5:18})}
    else if(current&&current!==expected)conflict=true}
  if(conflict&&!matched)return Object.freeze({state:"not-applicable",reasons:Object.freeze([])});
  const state:ApplicabilityMatch=specific>=2?"direct":specific===1&&matched>=2?"strong":specific===1?"partial":matched?"weak":"not-applicable";
  if(matched)reasons.push({code:"context-overlap",detail:`${matched} applicability dimensions matched the decision context.`,contribution:Math.min(20,matched*6)});
  return Object.freeze({state,reasons:Object.freeze(reasons)});
}
function projectionConfidence(items:readonly RelevantLearning[]):LearningConfidence{
  if(!items.length)return"insufficient-evidence";const minimum=Math.min(...items.map(x=>confidenceRank[x.confidence]));
  return(["insufficient-evidence","low","moderate","high"]as const)[minimum]??"insufficient-evidence";
}
function ageDays(first:string,second:string){return Math.abs(Date.parse(second)-Date.parse(first))/86400000}
function categoryMatchesCapability(category:string,capability:LearningDecisionContext["capability"]){
  const mapping:Record<LearningDecisionContext["capability"],readonly string[]>={
    investment:["investment"],revenue:["revenue"],capital:["capital"],
    financial:["financial"],portfolio:["portfolio"],"guest-communications":["guest-experience","operations"],
    "guidebook-studio":["guest-experience","operations"],operations:["operations"]};
  return mapping[capability].includes(category);
}
