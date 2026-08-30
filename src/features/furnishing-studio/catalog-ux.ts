export type CatalogScope = "platform" | "workspace";
export type CatalogLifecycle = "draft" | "in_review" | "approved" | "discontinued" | "archived";
export type CatalogPermission = Readonly<{ canCreateWorkspace: boolean; canCreatePlatform: boolean; canAdopt: boolean; canSubmit: boolean; canApprove: boolean; canRetire: boolean }>;

export function catalogScopeLabel(scope: CatalogScope, status?: CatalogLifecycle) {
  if (scope === "platform") return "Platform library";
  if (status === "draft") return "Workspace draft";
  if (status === "in_review") return "In review";
  if (status === "approved") return "Approved";
  if (status === "discontinued" || status === "archived") return "Retired";
  return "Workspace catalog";
}
export function catalogLifecycleLabel(status: CatalogLifecycle) {
  return ({ draft: "Draft", in_review: "In review", approved: "Approved", discontinued: "Retired", archived: "Retired" })[status];
}
export function catalogActions(input: { role?: string | null; scope: CatalogScope; status: CatalogLifecycle; controlledWorkspace: boolean }): CatalogPermission {
  const admin = input.role === "admin";
  return { canCreateWorkspace: admin && input.controlledWorkspace, canCreatePlatform: admin, canAdopt: admin && input.controlledWorkspace && input.scope === "platform" && input.status !== "archived", canSubmit: admin && input.scope === "workspace" && input.status === "draft", canApprove: admin && input.scope === "workspace" && input.status === "in_review", canRetire: admin && input.scope === "workspace" && input.status === "approved" };
}
export function adoptionEligibility(input: { scope: CatalogScope; workspaceId: string | null; status: CatalogLifecycle; existingWorkspaceProductId?: string | null }) {
  if (input.existingWorkspaceProductId) return { eligible: false as const, code: "existing_match", existingProductId: input.existingWorkspaceProductId };
  if (input.scope !== "platform" || input.workspaceId !== null) return { eligible: false as const, code: "source_scope_invalid" };
  if (input.status === "archived") return { eligible: false as const, code: "source_archived" };
  return { eligible: true as const, code: "eligible" };
}
export function serializeCatalogFilters(input: Record<string, string | undefined>) {
  const allowed = ["view", "q", "status", "category", "retailer", "availability", "attention", "sort", "workspace", "page"];
  const params = new URLSearchParams();
  for (const key of allowed) if (input[key]?.trim()) params.set(key, input[key]!.trim());
  return params.toString();
}
export function catalogAttentionPriority(issues: readonly string[]) {
  if (issues.some((issue) => /duplicate|scope|approval/i.test(issue))) return 3;
  if (issues.some((issue) => /missing|unavailable/i.test(issue))) return 2;
  return issues.length ? 1 : 0;
}
