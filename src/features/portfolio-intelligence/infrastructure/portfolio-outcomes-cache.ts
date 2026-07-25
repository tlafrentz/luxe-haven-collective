export type PortfolioOutcomesCacheIdentity = Readonly<{
  workspaceId: string; authorizedPropertyIds: readonly string[]; role: string;
  decisionRevisionFingerprint: string; outcomePolicyVersion: string;
}>;
export function portfolioOutcomesCacheKey(input: PortfolioOutcomesCacheIdentity) {
  return ["portfolio-outcomes", input.workspaceId, input.role,
    [...input.authorizedPropertyIds].sort().join(","),
    input.decisionRevisionFingerprint, input.outcomePolicyVersion].join(":");
}

