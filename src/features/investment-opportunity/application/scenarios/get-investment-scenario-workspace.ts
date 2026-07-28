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
  analysisVersions: readonly Readonly<{id:string;number:number;createdAt:Date}>[];
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
  lifecycleEvents: readonly Readonly<{id:string;scenarioId:string;type:string;summary:string;occurredAt:Date}>[];
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
    records?:readonly ScenarioRecord[];
    events?:readonly Readonly<{id:string;scenarioId:string;eventType:string;safeSummary:string;occurredAt:string}>[];
    preferredScenarioId?:string;
  }>,
): InvestmentScenarioWorkspace {
  const props = opportunity.props;
  const analyses=new Map<string,OpportunityAnalysis>(props.analyses.map(item=>[item.id.value,item]));
  const scenarios = (input.records??[]).flatMap((record,index) => {
    const source=analyses.get(record.sourceAnalysisVersionId);
    return source?[projectScenario(source,input.preferredScenarioId===record.scenarioId,index,record)]:[];
  });
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
    analysisVersions:Object.freeze([...props.analyses].sort((a,b)=>b.sequence-a.sequence).map(item=>Object.freeze({id:item.id.value,number:item.sequence,createdAt:item.createdAt}))),
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
    lifecycleEvents:(input.events??[]).map(event=>Object.freeze({id:event.id,scenarioId:event.scenarioId,type:event.eventType,summary:event.safeSummary,occurredAt:new Date(event.occurredAt)})),
  };
  return deepFreeze(workspace);
}

function projectScenario(
  analysis: OpportunityAnalysis,
  preferred: boolean,
  index: number,
  record:ScenarioRecord,
): InvestmentScenario {
  const props = analysis.props;
  const versions = props.policyVersions;
  const assumptions = props.resultSnapshot.reanalysis?.userAssumptions ?? {};
  return {
    id: record.scenarioId,
    opportunityId: props.opportunityId.value,
    sourceAnalysisVersionId: record.sourceAnalysisVersionId,
    sourceAnalysisVersionNumber: props.sequence,
    ...(record.sourceScenarioId ? { sourceScenarioId: record.sourceScenarioId } : {}),
    ...(record.sourceScenarioName ? { sourceScenarioName: record.sourceScenarioName } : {}),
    name: record.name,
    description: record.description??(index === 0
      ? "Original calculated investment strategy."
      : `Immutable revision ${props.sequence} of the opportunity strategy.`),
    type: (record.scenarioType??(index === 0
      ? "base"
      : props.route === "rental-arbitrage"
        ? "rental-arbitrage"
        : "custom")) as InvestmentScenario["type"],
    status: record.status==="archived"?"archived":preferred ? "preferred" : "calculated",
    preferred,
    revision: props.sequence,
    metadataRevision:record.revision,
    ...(record.notes?{notes:record.notes}:{}),
    snapshot: {
      calculationVersion: props.lineage.investmentLifecycleResultId,
      engineVersion: versions.investmentAnalysisPolicy ?? "investment-engine-v1",
      evidenceVersion: versions.marketAnalysisPolicy ?? "evidence-v1",
      recommendationVersion: versions.investmentRecommendationPolicy ?? "recommendation-v1",
      scoreVersion: versions.investmentAnalysisPolicy ?? "score-v1",
      assumptions: { ...assumptions, ...record.assumptions },
      result: structuredClone(record.output),
      sourceSummary: structuredClone(props.sourceSummary),
      policyVersions: structuredClone(versions),
      capturedAt: new Date(props.createdAt),
    },
    createdBy: record.createdBy,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    ...(record.archivedAt?{archivedAt:new Date(record.archivedAt)}:{}),
  };
}

type ScenarioRecord=Readonly<{scenarioId:string;sourceAnalysisVersionId:string;sourceScenarioId?:string;sourceScenarioName?:string;name:string;scenarioType:string;description?:string;notes?:string;status:string;revision:number;assumptions:Readonly<Record<string,string|number|boolean>>;output:OpportunityAnalysis["props"]["resultSnapshot"];createdBy:string;createdAt:string;updatedAt:string;archivedAt?:string}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
