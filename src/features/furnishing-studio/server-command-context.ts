import "server-only";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type FurnishingCommandTarget =
  | "workspace"
  | "import"
  | "package"
  | "package_version"
  | "room_package"
  | "room_package_version"
  | "room_package_item"
  | "plan"
  | "selection"
  | "project"
  | "snapshot"
  | "baseline"
  | "budget"
  | "batch"
  | "order"
  | "line"
  | "discrepancy"
  | "cleanup";

type IssueInput = Readonly<{
  workflow: `fs008g-finalization:${string}`;
  workspaceId: string;
  commandType: string;
  targetType: FurnishingCommandTarget;
  targetId: string;
}>;

export type FurnishingCommandContext = Readonly<{
  candidateCommit: string;
  workflow: string;
  workspaceId: string;
  actorId: string;
  actorRole: string;
  commandType: string;
  targetType: FurnishingCommandTarget;
  targetId: string;
  correlationId: string;
  idempotencyKey: string;
  expiresAt: string;
}>;

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const candidate = () =>
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_CANDIDATE_COMMIT ||
  "local-fs008g-finalization";
const contextError = (error: unknown) =>
  String((error as { message?: unknown } | null)?.message ?? "").match(
    /FS008G_CONTEXT_[A-Z_]+/,
  )?.[0] ?? "FS008G_CONTEXT_UNAVAILABLE";

async function authoritativeWorkspace(
  targetType: FurnishingCommandTarget,
  targetId: string,
) {
  const db = createAdminClient();
  if (targetType === "workspace" || targetType === "cleanup") {
    const { data } = await db
      .from("owners")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.id ? String(data.id) : null;
  }
  const direct: Partial<
    Record<FurnishingCommandTarget, readonly [string, string]>
  > = {
    import: ["furnishing_catalog_imports", "workspace_id"],
    package: ["furnishing_packages", "workspace_id"],
    room_package: ["furnishing_room_packages", "workspace_id"],
    project: ["furnishing_projects", "workspace_id"],
    snapshot: ["fs008d_project_catalog_snapshots", "tenant_id"],
  };
  const mapping = direct[targetType];
  if (mapping) {
    const { data } = await db
      .from(mapping[0])
      .select(mapping[1])
      .eq("id", targetId)
      .maybeSingle();
    return data
      ? String((data as unknown as Record<string, unknown>)[mapping[1]])
      : null;
  }
  const nested: Partial<
    Record<FurnishingCommandTarget, readonly [string, string]>
  > = {
    package_version: ["furnishing_package_versions", "furnishing_package_id"],
    room_package_version: [
      "furnishing_room_package_versions",
      "room_package_id",
    ],
    room_package_item: [
      "furnishing_room_package_items",
      "room_package_version_id",
    ],
    plan: ["furnishing_plans", "project_id"],
    selection: ["furnishing_product_selections", "furnishing_plan_id"],
    baseline: ["furnishing_procurement_baselines", "project_id"],
    budget: ["furnishing_project_procurement_budgets", "baseline_id"],
    batch: ["furnishing_purchase_batches", "baseline_id"],
    order: ["furnishing_procurement_orders", "baseline_id"],
    line: ["furnishing_procurement_lines", "baseline_id"],
    discrepancy: ["furnishing_procurement_exceptions", "baseline_id"],
  };
  const relation = nested[targetType];
  if (!relation) return null;
  const { data } = await db
    .from(relation[0])
    .select(relation[1])
    .eq("id", targetId)
    .maybeSingle();
  if (!data) return null;
  const parentId = String(
    (data as unknown as Record<string, unknown>)[relation[1]],
  );
  if (targetType === "package_version") {
    const { data: pkg } = await db
      .from("furnishing_packages")
      .select("workspace_id")
      .eq("id", parentId)
      .maybeSingle();
    return pkg?.workspace_id ? String(pkg.workspace_id) : null;
  }
  if (targetType === "room_package_version") {
    const { data: pkg } = await db
      .from("furnishing_room_packages")
      .select("workspace_id")
      .eq("id", parentId)
      .maybeSingle();
    return pkg?.workspace_id ? String(pkg.workspace_id) : null;
  }
  if (targetType === "room_package_item") {
    const { data: version } = await db
      .from("furnishing_room_package_versions")
      .select("room_package_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!version?.room_package_id) return null;
    const { data: pkg } = await db
      .from("furnishing_room_packages")
      .select("workspace_id")
      .eq("id", version.room_package_id)
      .maybeSingle();
    return pkg?.workspace_id ? String(pkg.workspace_id) : null;
  }
  let projectId: string | null = null;
  if (targetType === "plan") projectId = parentId;
  if (targetType === "selection") {
    const { data: plan } = await db
      .from("furnishing_plans")
      .select("project_id")
      .eq("id", parentId)
      .maybeSingle();
    projectId = plan?.project_id ? String(plan.project_id) : null;
  }
  if (projectId) {
    const { data: project } = await db
      .from("furnishing_projects")
      .select("workspace_id")
      .eq("id", projectId)
      .maybeSingle();
    return project?.workspace_id ? String(project.workspace_id) : null;
  }
  const { data: baseline } = await db
    .from("furnishing_procurement_baselines")
    .select("project_id")
    .eq("id", targetType === "baseline" ? targetId : parentId)
    .maybeSingle();
  if (!baseline?.project_id) return null;
  const { data: project } = await db
    .from("furnishing_projects")
    .select("workspace_id")
    .eq("id", baseline.project_id)
    .maybeSingle();
  return project?.workspace_id ? String(project.workspace_id) : null;
}

export async function issueFurnishingCommandContext(input: IssueInput) {
  const { user, profile } = await requireUser();
  if (
    !uuid.test(input.workspaceId) ||
    !input.targetId ||
    !/^[a-z0-9_.-]+$/.test(input.commandType)
  )
    throw new Error("FS008G_CONTEXT_INPUT_INVALID");
  const resolvedWorkspace = await authoritativeWorkspace(
    input.targetType,
    input.targetId,
  );
  if (resolvedWorkspace !== input.workspaceId)
    throw new Error("FS008G_CONTEXT_TARGET_MISMATCH");
  const actorId = String(profile?.id ?? user.id),
    actorRole = String(profile?.role ?? "customer");
  if (actorRole !== "admin") {
    const membershipDb = createAdminClient();
    const { data: membership } = await membershipDb
      .from("workspace_memberships")
      .select("id")
      .eq("workspace_id", resolvedWorkspace)
      .eq("profile_id", actorId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("FS008G_CONTEXT_TENANT_DENIED");
  }
  const db = createAdminClient();
  const { data, error } = await db.rpc(
    "issue_fs008g_furnishing_command_context" as never,
    {
      p_input: {
        actorId,
        actorRole,
        candidateCommit: candidate(),
        workflow: input.workflow,
        workspaceId: resolvedWorkspace,
        commandType: input.commandType,
        targetType: input.targetType,
        targetId: input.targetId,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
    } as never,
  );
  if (error || !data) throw new Error(contextError(error));
  return data as unknown as { contextId: string; expiresAt: string };
}

export async function resolveFurnishingCommandContext(
  contextId: string,
  expected: Readonly<{
    commandType: string;
    targetType: FurnishingCommandTarget;
  }>,
) {
  if (!uuid.test(contextId)) throw new Error("FS008G_CONTEXT_MISSING");
  const { user, profile } = await requireUser();
  const actorId = String(profile?.id ?? user.id),
    db = createAdminClient();
  const { data, error } = await db.rpc(
    "resolve_fs008g_furnishing_command_context" as never,
    { p_context_id: contextId, p_actor_id: actorId } as never,
  );
  if (error || !data) throw new Error(contextError(error));
  const context = data as unknown as FurnishingCommandContext;
  if (context.candidateCommit !== candidate())
    throw new Error("FS008G_CONTEXT_CANDIDATE_MISMATCH");
  if (
    context.commandType !== expected.commandType ||
    context.targetType !== expected.targetType
  )
    throw new Error("FS008G_CONTEXT_COMMAND_MISMATCH");
  const workspace = await authoritativeWorkspace(
    context.targetType,
    context.targetId,
  );
  if (workspace !== context.workspaceId)
    throw new Error("FS008G_CONTEXT_TARGET_MISMATCH");
  return context;
}
