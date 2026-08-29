export type GovernedScope = Readonly<{
  scope: "platform" | "workspace";
  workspaceId: string | null;
}>;

export type GovernedOfferAssignment = Readonly<{
  offerId: string;
  role: "preferred" | "alternate";
  rank: number;
  approvalStatus: "pending" | "approved" | "rejected" | "revoked";
  offerStatus: string;
  productId: string;
}>;

export function validateGovernedScope(value: GovernedScope) {
  if (value.scope === "workspace" && !value.workspaceId)
    return ["Workspace scope requires a workspace"];
  if (value.scope === "platform" && value.workspaceId)
    return ["Platform scope cannot name a workspace"];
  return [];
}

export function validateOfferAssignments(
  productId: string,
  assignments: readonly GovernedOfferAssignment[],
) {
  const issues: string[] = [];
  const approved = assignments.filter(
    (item) => item.approvalStatus === "approved",
  );
  if (approved.filter((item) => item.role === "preferred").length !== 1)
    issues.push("Exactly one approved preferred offer is required");
  if (new Set(approved.map((item) => item.rank)).size !== approved.length)
    issues.push("Approved offer ranks must be unique");
  if (approved.some((item) => item.productId !== productId))
    issues.push("Offer assignment product mismatch");
  if (approved.some((item) => item.offerStatus !== "active"))
    issues.push("Assigned offers must be active");
  return issues;
}

export function internalCohortVisible(
  input: Readonly<{
    globalState: string;
    globalKillSwitch: boolean;
    configurationValid: boolean;
    workspaceEnabled: boolean;
    workspaceKillSwitch: boolean;
    cohort: string;
    revoked: boolean;
    catalogViewingEnabled: boolean;
  }>,
) {
  return (
    input.globalState === "internal" &&
    !input.globalKillSwitch &&
    input.configurationValid &&
    input.workspaceEnabled &&
    !input.workspaceKillSwitch &&
    input.cohort === "internal" &&
    !input.revoked &&
    input.catalogViewingEnabled
  );
}
