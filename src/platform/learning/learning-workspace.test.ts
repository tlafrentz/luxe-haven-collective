import { describe, expect, it } from "vitest";
import {
  buildLearningWorkspace, calculateKnowledgeHealth, searchLessons,
  type LearningWorkspaceLesson, type LearningWorkspaceReview,
} from ".";
const lesson=(overrides:Partial<LearningWorkspaceLesson>={}):LearningWorkspaceLesson=>Object.freeze({
  id:"lesson:1:v1",seriesId:"lesson:1",revision:1,subjectId:"subject:1",
  title:"Weekend pricing",statement:"Weekend ADR increases improve RevPAR.",category:"revenue",
  applicability:Object.freeze([{dimension:"market" as const,value:"Phoenix"},{dimension:"strategy" as const,value:"weekend-pricing"}]),
  confidence:"moderate",maturity:"emerging",status:"validated",contradictionState:"none",
  evidenceCount:2,sourceReviewIds:Object.freeze(["review:1"]),sourceCandidateIds:Object.freeze(["candidate:1"]),
  policyVersion:"lesson-v1",validatedAt:"2026-07-01T00:00:00.000Z",...overrides});
const review=(overrides:Partial<LearningWorkspaceReview>={}):LearningWorkspaceReview=>Object.freeze({
  id:"review:1:v1",seriesId:"review:1",subjectId:"subject:1",revision:1,status:"completed",
  confidence:"high",freshness:"current",completedAt:"2026-07-01T00:00:00.000Z",planRevision:1,
  evaluationPolicyVersion:"evaluation-v1",metricCount:3,evidenceCount:2,summaryStatus:"met",...overrides});
describe("Learning Workspace read models",()=>{
  it("searches statement, category, and applicability context",()=>{
    const lessons=[lesson(),lesson({id:"lesson:2",seriesId:"lesson:2",category:"capital",statement:"Hot tubs improve annual revenue.",applicability:[{dimension:"market" as const,value:"Mesa"}]})];
    expect(searchLessons(lessons,{query:"Phoenix"})).toHaveLength(1);
    expect(searchLessons(lessons,{category:"capital",market:"Mesa"})).toHaveLength(1);
    expect(searchLessons(lessons,{strategy:"weekend-pricing"})).toHaveLength(1);
  });
  it("projects dashboard metrics without presentation calculations",()=>{
    const model=buildLearningWorkspace({lessons:[lesson()],reviews:[review()],contradictions:[],candidateCount:2,unvalidatedAssumptionCount:1,evaluatedAt:"2026-07-25T00:00:00.000Z"});
    expect(model.dashboard.metrics).toMatchObject({reviewsCompleted:1,validatedLessons:1,candidateLessons:2});
    expect(model.gaps.some(x=>x.type==="unvalidated-assumption")).toBe(true);
  });
  it("keeps maturity separate from confidence in health",()=>{
    const health=calculateKnowledgeHealth([lesson({confidence:"high",maturity:"emerging"})],[review()],[],"2026-07-25T00:00:00.000Z");
    expect(health.confidence).toBe(1);
    expect(health.maturity).toBe(0);
  });
  it("surfaces contradictions and low-confidence gaps",()=>{
    const model=buildLearningWorkspace({lessons:[lesson({confidence:"low",contradictionState:"possible"})],reviews:[review()],contradictions:[{id:"c1",firstLessonId:"l1",secondLessonId:"l2",state:"possible",rationale:"Opposing result",createdAt:"2026-07-20"}],candidateCount:0,unvalidatedAssumptionCount:0,evaluatedAt:"2026-07-25T00:00:00.000Z"});
    expect(model.gaps.map(x=>x.type)).toEqual(expect.arrayContaining(["low-confidence-lesson","contradiction"]));
  });
});
