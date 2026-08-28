export function actionPlanPath(planId: string, workspaceId: string, from: "plans"|"actions" = "plans") {
  const query = new URLSearchParams({ workspace: workspaceId, from });
  return `/dashboard/execute/plans/${encodeURIComponent(planId)}?${query.toString()}`;
}

export function actionPlanBackPath(workspaceId: string, from: string|undefined) {
  const view = from === "actions" ? "all" : "plans";
  return `/dashboard/execute?${new URLSearchParams({ view, workspace: workspaceId }).toString()}`;
}
