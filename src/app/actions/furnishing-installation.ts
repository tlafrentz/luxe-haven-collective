"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { launchReadiness } from "@/features/furnishing-studio";
import { assertFurnishingEntitlement } from "./furnishing-access";
import { assertFurnishingActivationMutationDisabled } from "@/features/furnishing-studio/activation";
// Pending FS migrations are intentionally outside generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
async function scope(projectId: string, write = false) {
  const { user, profile } = await requireUser(),
    db = createAdminClient(),
    { data: project } = await db
      .from("furnishing_projects")
      .select("*,properties(*)")
      .eq("id", projectId)
      .maybeSingle();
  if (!project) throw new Error("FURNISHING_PROJECT_NOT_FOUND");
  if (profile?.role !== "admin") {
    let query = db
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("profile_id", profile?.id)
      .eq("status", "active");
    if (write)
      query = query.in("role", [
        "owner",
        "administrator",
        "operator",
        "contributor",
      ]);
    const { data } = await query.maybeSingle();
    if (!data) throw new Error("FURNISHING_INSTALLATION_ACCESS_DENIED");
  }
  const { data: release } = await db
    .from("furnishing_activation_releases")
    .select("global_state")
    .eq("milestone", "FS-008A")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (write && release?.global_state === "internal")
    throw new Error("FS008G_INSTALLATION_UNAVAILABLE_FOR_INTERNAL_COHORT");
  if (write) assertFurnishingActivationMutationDisabled();
  await assertFurnishingEntitlement(
    String(project.workspace_id),
    profile?.role === "admin",
  );
  return { db, project: project as Row, actorId: profile?.id ?? user.id };
}
const refresh = (projectId: string) => {
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/installation`);
  revalidatePath(`/admin/furnishing/projects/${projectId}/installation`);
};
export async function getInstallationAvailability(projectId: string) {
  const { db } = await scope(projectId);
  const { data } = await db
    .from("furnishing_activation_releases")
    .select("global_state")
    .eq("milestone", "FS-008A")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    available: data?.global_state !== "internal",
    reason:
      data?.global_state === "internal"
        ? "FS008G_INSTALLATION_UNAVAILABLE_FOR_INTERNAL_COHORT"
        : null,
  };
}
export async function getInstallationWorkspace(projectId: string) {
  const { db, project } = await scope(projectId),
    { data: installation } = await db
      .from("furnishing_installation_projects")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
  if (!installation)
    return {
      project,
      installation: null,
      tasks: [],
      checks: [],
      punch: [],
      rooms: [],
      sessions: [],
      assessments: [],
      events: [],
      evidence: [],
      authorizations: [],
      handoff: null,
    };
  const [
    tasks,
    checks,
    punch,
    rooms,
    sessions,
    assessments,
    events,
    evidence,
    authorizations,
    handoffs,
  ] = await Promise.all([
    db
      .from("furnishing_installation_tasks")
      .select("*,furnishing_rooms(name)")
      .eq("installation_project_id", installation.id)
      .order("sort_order"),
    db
      .from("furnishing_site_readiness_checks")
      .select("*")
      .eq("installation_project_id", installation.id)
      .order("category"),
    db
      .from("furnishing_punch_list_items")
      .select("*")
      .eq("installation_project_id", installation.id)
      .order("created_at", { ascending: false }),
    db
      .from("furnishing_room_acceptances")
      .select("*,furnishing_rooms(name)")
      .eq("installation_project_id", installation.id),
    db
      .from("furnishing_installation_sessions")
      .select("*")
      .eq("installation_project_id", installation.id)
      .order("starts_at"),
    db
      .from("furnishing_launch_readiness_assessments")
      .select("*")
      .eq("installation_project_id", installation.id)
      .order("version", { ascending: false }),
    db
      .from("furnishing_installation_events")
      .select("*")
      .eq("installation_project_id", installation.id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    db
      .from("furnishing_installation_evidence")
      .select("*,furnishing_installation_tasks(item_name)")
      .eq("installation_project_id", installation.id)
      .eq("evidence_type", "photo")
      .order("captured_at", { ascending: false }),
    db
      .from("furnishing_launch_authorizations")
      .select("*")
      .eq("installation_project_id", installation.id)
      .order("decided_at", { ascending: false }),
    db
      .from("furnishing_launch_handoffs")
      .select("*")
      .eq("installation_project_id", installation.id)
      .maybeSingle(),
  ]);
  const failed = [
    tasks,
    checks,
    punch,
    rooms,
    sessions,
    assessments,
    events,
    evidence,
    authorizations,
    handoffs,
  ].find((x) => x.error)?.error;
  if (failed) throw new Error("FS007_WORKSPACE_UNAVAILABLE");
  return {
    project,
    installation,
    tasks: tasks.data ?? [],
    checks: checks.data ?? [],
    punch: punch.data ?? [],
    rooms: rooms.data ?? [],
    sessions: sessions.data ?? [],
    assessments: assessments.data ?? [],
    events: events.data ?? [],
    evidence: evidence.data ?? [],
    authorizations: authorizations.data ?? [],
    handoff: handoffs.data ?? null,
  };
}
export async function startInstallationAction(form: FormData) {
  const projectId = field(form, "projectId"),
    key = field(form, "idempotencyKey") || `installation-${projectId}`,
    { db, project, actorId } = await scope(projectId, true),
    { data: baseline } = await db
      .from("furnishing_procurement_baselines")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "closed")
      .maybeSingle();
  if (!baseline) throw new Error("FS007_CLOSED_PROCUREMENT_REQUIRED");
  const { data: existing } = await db
    .from("furnishing_installation_projects")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) return;
  const { data: installation, error } = await db
    .from("furnishing_installation_projects")
    .insert({
      workspace_id: project.workspace_id,
      property_id: project.property_id,
      project_id: project.id,
      procurement_baseline_id: baseline.id,
      status: "planning",
      timezone: project.properties?.timezone ?? "UTC",
      source_snapshot: {
        baselineVersion: baseline.version,
        sourcePlanId: baseline.source_plan_id,
        closedAt: baseline.closed_at,
      },
      source_hash: `${baseline.id}:${baseline.version}:${baseline.closed_at}`,
      idempotency_key: key,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error || !installation) throw new Error("FS007_START_FAILED");
  const { data: lines } = await db
    .from("furnishing_procurement_lines")
    .select("*,furnishing_rooms(name)")
    .eq("baseline_id", baseline.id)
    .in("status", ["fulfilled", "reconciled", "closed"]);
  const taskRows = (lines ?? [])
    .filter((x) => Number(x.accepted_quantity) > 0)
    .map((x, index) => ({
      project_id: projectId,
      installation_project_id: installation.id,
      room_id: x.room_id,
      procurement_line_id: x.id,
      room: x.furnishing_rooms?.name ?? "Unassigned",
      item_name: x.description,
      quantity_expected: x.accepted_quantity,
      status: "ready",
      task_type: "placement",
      required: true,
      sort_order: index,
    }));
  if (taskRows.length) {
    const inserted = await db
      .from("furnishing_installation_tasks")
      .insert(taskRows);
    if (inserted.error) throw new Error("FS007_TASK_CREATE_FAILED");
  }
  const defaults = [
    ["access_delivery", "Property access confirmed"],
    ["utilities", "Electricity active"],
    ["utilities", "Water active"],
    ["safety_protection", "Work areas protected"],
    ["technology", "Guest Wi-Fi active"],
    ["operations", "Essential supplies staged"],
    ["photography", "Listing photography complete"],
  ].map(([category, name]) => ({
    installation_project_id: installation.id,
    category,
    name,
    required: true,
  }));
  await db.from("furnishing_site_readiness_checks").insert(defaults);
  await db
    .from("furnishing_installation_events")
    .insert({
      installation_project_id: installation.id,
      workspace_id: project.workspace_id,
      property_id: project.property_id,
      project_id: project.id,
      actor_id: actorId,
      correlation_id: crypto.randomUUID(),
      event_type: "installation_project_started",
      resulting_version: 1,
      policy_version: "fs007-v1",
      related_type: "procurement_baseline",
      related_id: baseline.id,
      payload: { taskCount: taskRows.length },
    });
  refresh(projectId);
}
export async function updateInstallationTaskAction(form: FormData) {
  const projectId = field(form, "projectId"),
    taskId = field(form, "taskId"),
    status = field(form, "status"),
    { db, actorId } = await scope(projectId, true);
  const allowed = [
    "ready",
    "in_progress",
    "installed",
    "complete",
    "accepted",
    "damaged",
    "missing",
    "incorrect",
    "deferred",
  ];
  if (!allowed.includes(status)) throw new Error("FS007_TASK_STATUS_INVALID");
  const patch: Row = { status };
  if (status === "accepted") {
    patch.accepted_by = actorId;
    patch.accepted_at = new Date().toISOString();
  }
  const { error } = await db
    .from("furnishing_installation_tasks")
    .update(patch)
    .eq("id", taskId);
  if (error) throw new Error("FS007_OPERATION_FAILED");
  refresh(projectId);
}
export async function recordInstallationEvidenceAction(form: FormData) {
  const projectId = field(form, "projectId"),
    taskId = field(form, "taskId"),
    storagePath = field(form, "storagePath"),
    caption = field(form, "caption"),
    { db, actorId } = await scope(projectId, true);
  if (!storagePath) throw new Error("FS007_EVIDENCE_PATH_REQUIRED");
  if (!taskId) throw new Error("FS007_EVIDENCE_TASK_REQUIRED");
  const { data: installation } = await db
    .from("furnishing_installation_projects")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!installation) throw new Error("FS007_INSTALLATION_REQUIRED");
  const { error } = await db
    .from("furnishing_installation_evidence")
    .insert({
      installation_project_id: installation.id,
      task_id: taskId,
      evidence_type: "photo",
      storage_path: storagePath,
      caption: caption || null,
      metadata: { marketingConsent: false },
      captured_by: actorId,
    });
  if (error) throw new Error("FS007_OPERATION_FAILED");
  refresh(projectId);
}
export async function authorizeLaunchAction(form: FormData) {
  const projectId = field(form, "projectId"),
    decision = field(form, "decision"),
    reason = field(form, "reason"),
    { db, actorId } = await scope(projectId, true);
  if (!["authorized", "blocked", "returned_for_work"].includes(decision))
    throw new Error("FS007_LAUNCH_DECISION_INVALID");
  const workspace = await getInstallationWorkspace(projectId),
    installation = workspace.installation as Row,
    current = (workspace.assessments as Row[])[0];
  if (!installation) throw new Error("FS007_INSTALLATION_REQUIRED");
  if (!current) throw new Error("FS007_ASSESSMENT_REQUIRED");
  if (decision === "authorized" && !current.ready_for_authorization)
    throw new Error("FS007_READINESS_NOT_MET");
  const { data: existing } = await db
    .from("furnishing_launch_authorizations")
    .select("id")
    .eq("assessment_id", current.id)
    .maybeSingle();
  if (existing) throw new Error("FS007_ASSESSMENT_ALREADY_DECIDED");
  const { error } = await db
    .from("furnishing_launch_authorizations")
    .insert({
      installation_project_id: installation.id,
      assessment_id: current.id,
      decision,
      reason: reason || null,
      policy_version: "fs007-v1",
      decided_by: actorId,
    });
  if (error) throw new Error("FS007_OPERATION_FAILED");
  if (decision === "authorized")
    await db
      .from("furnishing_installation_projects")
      .update({ status: "authorized" })
      .eq("id", installation.id);
  refresh(projectId);
}
export async function createLaunchHandoffAction(form: FormData) {
  const projectId = field(form, "projectId"),
    { db, actorId } = await scope(projectId, true);
  const workspace = await getInstallationWorkspace(projectId),
    installation = workspace.installation as Row;
  if (!installation) throw new Error("FS007_INSTALLATION_REQUIRED");
  const authorization = (workspace.authorizations as Row[]).find(
    (a) => a.decision === "authorized",
  );
  if (!authorization) throw new Error("FS007_LAUNCH_NOT_AUTHORIZED");
  const { data: existing } = await db
    .from("furnishing_launch_handoffs")
    .select("id")
    .eq("installation_project_id", installation.id)
    .maybeSingle();
  if (existing) return;
  const rooms = workspace.rooms as Row[],
    punch = workspace.punch as Row[];
  const { error } = await db
    .from("furnishing_launch_handoffs")
    .insert({
      installation_project_id: installation.id,
      launch_authorization_id: authorization.id,
      operations_snapshot: {
        readinessPercent:
          (workspace.assessments as Row[])[0]?.readiness_percent ?? null,
      },
      room_snapshot: rooms.map((r) => ({
        roomId: r.room_id,
        status: r.status,
      })),
      open_nonblocking_items: punch
        .filter((p) => !p.blocking_launch && p.status !== "resolved")
        .map((p) => ({ id: p.id, issue: p.issue })),
      handed_off_by: actorId,
    });
  if (error) throw new Error("FS007_OPERATION_FAILED");
  await db
    .from("furnishing_installation_projects")
    .update({ status: "handed_off" })
    .eq("id", installation.id);
  refresh(projectId);
}
export async function updateReadinessCheckAction(form: FormData) {
  const projectId = field(form, "projectId"),
    checkId = field(form, "checkId"),
    status = field(form, "status"),
    { db, actorId } = await scope(projectId, true);
  if (!["pending", "passed", "failed"].includes(status))
    throw new Error("FS007_READINESS_STATUS_INVALID");
  const { error } = await db
    .from("furnishing_site_readiness_checks")
    .update({
      status,
      verified_by: actorId,
      verified_at: new Date().toISOString(),
      blocking_reason:
        status === "failed"
          ? field(form, "reason") || "Requires attention"
          : null,
    })
    .eq("id", checkId);
  if (error) throw new Error("FS007_OPERATION_FAILED");
  refresh(projectId);
}
export async function assessLaunchReadinessAction(form: FormData) {
  const projectId = field(form, "projectId"),
    { db, actorId } = await scope(projectId, true),
    workspace = await getInstallationWorkspace(projectId),
    installation = workspace.installation as Row;
  if (!installation) throw new Error("FS007_INSTALLATION_REQUIRED");
  const checks = (workspace.checks as Row[]).map((x) => ({
      id: String(x.id),
      category: String(x.category),
      required: Boolean(x.required),
      status: x.status,
      weight: Number(x.weight),
    })),
    blocking = (workspace.punch as Row[]).filter(
      (x) => x.blocking_launch && x.status !== "resolved",
    ).length,
    result = launchReadiness(checks, blocking),
    version = Number((workspace.assessments as Row[])[0]?.version ?? 0) + 1;
  const { error } = await db
    .from("furnishing_launch_readiness_assessments")
    .insert({
      installation_project_id: installation.id,
      version,
      policy_version: "fs007-v1",
      readiness_percent: result.percent,
      category_results: checks,
      blockers: result.blockers,
      ready_for_authorization: result.readyForHumanAuthorization,
      source_revision: installation.version,
      assessed_by: actorId,
    });
  if (error) throw new Error("FS007_OPERATION_FAILED");
  refresh(projectId);
}
