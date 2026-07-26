import type {
  InvestmentOpportunity,
  InvestmentScenario,
  OpportunityAnalysis,
} from "../../domain";

export type InvestmentScenarioWorkspace = Readonly<{
  opportunity: Readonly<{
    id: string;
    name: string;
    address: string;
    route: "purchase" | "rental-arbitrage";
  }>;
  scenarios: readonly InvestmentScenario[];
  activeScenarios: readonly InvestmentScenario[];
  archivedScenarios: readonly InvestmentScenario[];
  preferredScenario?: InvestmentScenario;
  capabilities: Readonly<{
    view: boolean;
    create: boolean;
    modify: boolean;
    archive: boolean;
    report: boolean;
    administer: boolean;
  }>;
  state: "empty" | "complete" | "partial" | "degraded";
  evaluatedAt: Date;
  aggregateVersion: number;
}>;

/**
 * Canonical query projection for PC-001B. Opportunity analyses are already
 * append-only snapshots, so the query promotes them to calculated scenario
 * revisions without recalculating any financial value.
 */
export function getInvestmentScenarioWorkspace(
  opportunity: InvestmentOpportunity,
  input: Readonly<{
    actorId: string;
    canManage?: boolean;
    evaluatedAt?: Date;
  }>,
): InvestmentScenarioWorkspace {
  const props = opportunity.props;
  const scenarios = props.analyses.map((analysis, index) =>
    projectScenario(analysis, props.currentAnalysisId?.value === analysis.id.value, index),
  );
  const evidenceLimited = scenarios.some(({ snapshot }) =>
    snapshot.result.dataGaps.length > 0,
  );
  const workspace: InvestmentScenarioWorkspace = {
    opportunity: {
      id: props.id.value,
      name: props.name.value,
      address: props.property.displayAddress,
      route: props.route,
    },
    scenarios,
    activeScenarios: scenarios.filter(({ status }) => status !== "archived"),
    archivedScenarios: scenarios.filter(({ status }) => status === "archived"),
    preferredScenario: scenarios.find(({ preferred }) => preferred),
    capabilities: {
      view: true,
      create: !props.archivedAt,
      modify: !props.archivedAt,
      archive: !props.archivedAt,
      report: true,
      administer: Boolean(input.canManage),
    },
    state: scenarios.length === 0
      ? "empty"
      : evidenceLimited
        ? "partial"
        : "complete",
    evaluatedAt: new Date(input.evaluatedAt ?? new Date()),
    aggregateVersion: props.version,
  };
  return deepFreeze(workspace);
}

function projectScenario(
  analysis: OpportunityAnalysis,
  preferred: boolean,
  index: number,
): InvestmentScenario {
  const props = analysis.props;
  const versions = props.policyVersions;
  const assumptions = props.resultSnapshot.reanalysis?.userAssumptions ?? {};
  return {
    id: props.id.value,
    opportunityId: props.opportunityId.value,
    name: index === 0 ? "Base Scenario" : `Scenario ${props.sequence}`,
    description: index === 0
      ? "Original calculated investment strategy."
      : `Immutable revision ${props.sequence} of the opportunity strategy.`,
    type: index === 0
      ? "base"
      : props.route === "rental-arbitrage"
        ? "rental-arbitrage"
        : "custom",
    status: preferred ? "preferred" : "calculated",
    preferred,
    revision: props.sequence,
    snapshot: {
      calculationVersion: props.lineage.investmentLifecycleResultId,
      engineVersion: versions.investmentAnalysisPolicy ?? "investment-engine-v1",
      evidenceVersion: versions.marketAnalysisPolicy ?? "evidence-v1",
      recommendationVersion: versions.investmentRecommendationPolicy ?? "recommendation-v1",
      scoreVersion: versions.investmentAnalysisPolicy ?? "score-v1",
      assumptions: { ...assumptions },
      result: structuredClone(props.resultSnapshot),
      sourceSummary: structuredClone(props.sourceSummary),
      policyVersions: structuredClone(versions),
      capturedAt: new Date(props.createdAt),
    },
    createdBy: props.createdBy.id,
    createdAt: new Date(props.createdAt),
    updatedAt: new Date(props.createdAt),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
