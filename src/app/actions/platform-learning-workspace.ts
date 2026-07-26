"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import {
  evaluateWorkspacePermission, resolveWorkspaceAccessContext, SupabaseTeamAccessRepository,
} from "@/features/workspace";
import {
  buildLearningWorkspace, searchLessons, type LearningContradictionSummary,
  type LearningWorkspaceLesson, type LearningWorkspaceReadModel, type LearningWorkspaceReview,
  type LessonSearchFilters, resolveRelevantLearning, type LearningDecisionContext,
} from "@/platform/learning";

type Row = Record<string, unknown>;

async function context(workspaceId?: string) {
  const { user } = await getSessionProfile();
  if (!user) throw new Error("learning_permission_denied");
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, workspaceId);
  if (!evaluateWorkspacePermission(access, "learning.view") ||
      !evaluateWorkspacePermission(access, "learning.lessons.view"))
    throw new Error("learning_permission_denied");
  return access;
}

export async function getPlatformLearningWorkspace(workspaceId?: string): Promise<LearningWorkspaceReadModel> {
  const access = await context(workspaceId);
  const client = await createClient();
  const [{ data: lessonRows }, { data: applicabilityRows }, { data: reviewRows },
    { data: summaryRows }, { data: relationshipRows }, { count: candidateCount },
    { count: assumptionCount }, { count: resultCount }] = await Promise.all([
    client.from("learning_lesson_versions").select("*").eq("workspace_id", access.workspaceId).order("created_at", { ascending: false }).limit(500),
    client.from("learning_lesson_applicability").select("*").eq("workspace_id", access.workspaceId).limit(2000),
    client.from("learning_outcome_review_revisions").select("*").eq("workspace_id", access.workspaceId).order("created_at", { ascending: false }).limit(500),
    client.from("learning_review_summaries").select("*").eq("workspace_id", access.workspaceId).limit(500),
    client.from("learning_lesson_relationships").select("*").eq("workspace_id", access.workspaceId).eq("relationship_type", "contradicts").limit(500),
    client.from("learning_candidate_lessons").select("*", { count: "exact", head: true }).eq("workspace_id", access.workspaceId).eq("status", "candidate"),
    client.from("learning_assumptions").select("*", { count: "exact", head: true }).eq("workspace_id", access.workspaceId),
    client.from("learning_validated_assumption_results").select("*", { count: "exact", head: true }).eq("workspace_id", access.workspaceId),
  ]);
  const applicability = (applicabilityRows ?? []) as Row[];
  const summaries = new Map(((summaryRows ?? []) as Row[]).map(row => [`${text(row,"outcome_review_id")}:${number(row,"review_revision")}`, row]));
  const lessons = ((lessonRows ?? []) as Row[]).map(row => mapLesson(row, applicability));
  const reviews = ((reviewRows ?? []) as Row[]).map(row => mapReview(row, summaries));
  const contradictions = ((relationshipRows ?? []) as Row[]).map(mapContradiction);
  return buildLearningWorkspace({
    lessons, reviews, contradictions, candidateCount: candidateCount ?? 0,
    unvalidatedAssumptionCount: Math.max(0, (assumptionCount ?? 0) - (resultCount ?? 0)),
    evaluatedAt: new Date().toISOString(),
  });
}

export async function listPlatformLearningLessons(input: LessonSearchFilters & { workspaceId?: string }) {
  const workspace = await getPlatformLearningWorkspace(input.workspaceId);
  return searchLessons(workspace.lessons, input);
}
export async function getPlatformLearningLesson(id: string, workspaceId?: string) {
  const workspace = await getPlatformLearningWorkspace(workspaceId);
  return workspace.lessons.find(item => item.id === id) ?? null;
}
export async function getPlatformOutcomeReview(id: string, workspaceId?: string) {
  const workspace = await getPlatformLearningWorkspace(workspaceId);
  return workspace.reviews.find(item => item.id === id) ?? null;
}
export async function getPlatformLearningLessonDetail(id: string, workspaceId?: string) {
  const access = await context(workspaceId), client = await createClient();
  const { data: lesson } = await client.from("learning_lesson_versions").select("*")
    .eq("workspace_id", access.workspaceId).eq("id", id).maybeSingle();
  if (!lesson) return null;
  const row = lesson as Row, seriesId = text(row,"series_id");
  const [{ data: versions }, { data: applicability }, { data: relationships }, { data: activity }] = await Promise.all([
    client.from("learning_lesson_versions").select("*").eq("workspace_id",access.workspaceId).eq("series_id",seriesId).order("revision",{ascending:false}),
    client.from("learning_lesson_applicability").select("*").eq("workspace_id",access.workspaceId).eq("lesson_version_id",id),
    client.from("learning_lesson_relationships").select("*").eq("workspace_id",access.workspaceId).or(`from_lesson_id.eq.${id},to_lesson_id.eq.${id}`),
    client.from("learning_lesson_activity").select("*").eq("workspace_id",access.workspaceId).eq("lesson_series_id",seriesId).order("occurred_at",{ascending:false}),
  ]);
  return Object.freeze({
    lesson: mapLesson(row, (applicability ?? []) as Row[]),
    evidence: Object.freeze(array(row.evidence_references) as Row[]),
    versions: Object.freeze((versions ?? []) as Row[]),
    relationships: Object.freeze((relationships ?? []) as Row[]),
    activity: Object.freeze((activity ?? []) as Row[]),
  });
}
export async function getPlatformOutcomeReviewDetail(id: string, workspaceId?: string) {
  const access = await context(workspaceId), client = await createClient();
  const { data: review } = await client.from("learning_outcome_review_revisions").select("*")
    .eq("workspace_id",access.workspaceId).eq("id",id).maybeSingle();
  if (!review) return null;
  const row=review as Row,revision=number(row,"revision");
  const [{data:evaluations},{data:measurements},{data:summary},{data:lessons},{data:activity}]=await Promise.all([
    client.from("learning_metric_evaluations").select("*").eq("workspace_id",access.workspaceId).eq("outcome_review_id",id).eq("review_revision",revision),
    client.from("learning_measured_outcome_revisions").select("*").eq("workspace_id",access.workspaceId).eq("outcome_review_id",id),
    client.from("learning_review_summaries").select("*").eq("workspace_id",access.workspaceId).eq("outcome_review_id",id).eq("review_revision",revision).maybeSingle(),
    client.from("learning_lesson_versions").select("id,statement,status,maturity,confidence,source_review_ids").eq("workspace_id",access.workspaceId).contains("source_review_ids",[id]),
    client.from("learning_activity").select("*").eq("workspace_id",access.workspaceId).eq("subject_id",text(row,"learning_subject_id")).order("occurred_at",{ascending:false}).limit(100),
  ]);
  return Object.freeze({review:mapReview(row,new Map(summary?[[`${id}:${revision}`,summary as Row]]:[])),
    expected:Object.freeze(array(row.expected_outcome_snapshots) as Row[]),
    evaluations:Object.freeze((evaluations??[]) as Row[]),measurements:Object.freeze((measurements??[]) as Row[]),
    evidence:Object.freeze(array(row.evidence_references) as Row[]),lessons:Object.freeze((lessons??[]) as Row[]),
    activity:Object.freeze((activity??[]) as Row[])});
}
export async function getRelevantLearning(input:
  Omit<LearningDecisionContext,"workspaceId"|"evaluatedAt"> & {workspaceId?:string;evaluatedAt?:string}) {
  const startedAt=Date.now(),access=await context(input.workspaceId),workspace=await getPlatformLearningWorkspace(access.workspaceId);
  const client=await createClient();
  const projection=await resolveRelevantLearning({
    async listValidatedLessons(workspaceId){return workspaceId===access.workspaceId?workspace.lessons:[]},
    async getEvidence(lessonId){
      const {data}=await client.from("learning_lesson_versions").select("evidence_references")
        .eq("workspace_id",access.workspaceId).eq("id",lessonId).maybeSingle();
      return Object.freeze(array((data as Row|null)?.evidence_references) as import("@/platform/learning").LearningReference[]);
    },
  },Object.freeze({...input,workspaceId:access.workspaceId,evaluatedAt:input.evaluatedAt??new Date().toISOString()}));
  console.info("relevant_learning_resolved",{workspaceId:access.workspaceId,capability:input.capability,
    subjectType:input.subjectType,subjectId:input.subjectId,state:projection.state,
    lessonCount:projection.lessons.length,confidence:projection.confidence,
    policyVersion:projection.policyVersion,durationMilliseconds:Date.now()-startedAt});
  return projection;
}

function mapLesson(row: Row, applicabilityRows: Row[]): LearningWorkspaceLesson {
  const statement = text(row, "statement");
  return Object.freeze({
    id: text(row,"id"), seriesId: text(row,"series_id"), revision: number(row,"revision"),
    subjectId: text(row,"learning_subject_id"), title: statement.split(/[.!?]/)[0] || "Learning lesson",
    statement, category: text(row,"category"),
    applicability: Object.freeze(applicabilityRows.filter(a => text(a,"lesson_version_id") === text(row,"id")).map(a => Object.freeze({
      dimension: text(a,"dimension") as LearningWorkspaceLesson["applicability"][number]["dimension"],
      ...(a.reference_id ? { referenceId: text(a,"reference_id") } : {}),
      ...(a.value ? { value: text(a,"value") } : {}),
    }))),
    confidence: text(row,"confidence") as LearningWorkspaceLesson["confidence"],
    maturity: text(row,"maturity") as LearningWorkspaceLesson["maturity"],
    status: text(row,"status") as LearningWorkspaceLesson["status"],
    contradictionState: text(row,"contradiction_state") as LearningWorkspaceLesson["contradictionState"],
    evidenceCount: array(row.evidence_references).length,
    sourceReviewIds: strings(row.source_review_ids), sourceCandidateIds: strings(row.source_candidate_ids),
    policyVersion: text(row,"policy_version"), validatedAt: text(row,"created_at"),
    ...(row.supersedes_lesson_id ? { supersedesLessonId: text(row,"supersedes_lesson_id") } : {}),
  });
}
function mapReview(row: Row, summaries: Map<string, Row>): LearningWorkspaceReview {
  const summary = summaries.get(`${text(row,"id")}:${number(row,"revision")}`);
  return Object.freeze({
    id: text(row,"id"), seriesId: text(row,"series_id"), subjectId: text(row,"learning_subject_id"),
    revision: number(row,"revision"), status: text(row,"status"),
    confidence: text(row,"confidence") as LearningWorkspaceReview["confidence"],
    freshness: text(row,"data_freshness"), planRevision: number(row,"measurement_plan_revision"),
    evaluationPolicyVersion: text(row,"evaluation_policy_version"),
    metricCount: array(row.measured_outcome_ids).length, evidenceCount: array(row.evidence_references).length,
    ...(row.scheduled_at ? { scheduledAt: text(row,"scheduled_at") } : {}),
    ...(row.completed_at ? { completedAt: text(row,"completed_at") } : {}),
    ...(summary ? { summaryStatus: text(summary,"status"), materiality: text(summary,"materiality") } : {}),
  });
}
function mapContradiction(row: Row): LearningContradictionSummary {
  return Object.freeze({ id: text(row,"id"), firstLessonId: text(row,"from_lesson_id"),
    secondLessonId: text(row,"to_lesson_id"),
    state: text(row,"contradiction_state") as LearningContradictionSummary["state"],
    rationale: text(row,"rationale"), createdAt: text(row,"created_at") });
}
function text(row: Row, key: string) { return String(row[key] ?? ""); }
function number(row: Row, key: string) { return Number(row[key] ?? 0); }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function strings(value: unknown) { return array(value).map(String); }
