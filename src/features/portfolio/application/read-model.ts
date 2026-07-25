import { evaluatePropertyAccess, evaluateWorkspacePermission, type WorkspaceAccessContext } from "@/features/workspace";
import { ConfidenceLevel } from "@/platform/scoring";
import {
  aggregatePortfolioConfidence,
  aggregatePortfolioFreshness,
  aggregatePortfolioMetrics,
  assertPortfolioPeriod,
  type DataFreshness,
  type PortfolioAuthorizationScope,
  type PortfolioEvidenceKind,
  type PortfolioPeriod,
  type PortfolioProjection,
  type PortfolioPropertyProjection,
  type PortfolioScope,
} from "../domain/read-model";

export type PortfolioPropertySource = Omit<PortfolioPropertyProjection, "contribution">;

export interface PortfolioProjectionSource {
  listWorkspaceProperties(workspaceId: string): Promise<readonly Readonly<{ propertyId: string; included: boolean }>[]>;
  loadAuthorizedProperties(workspaceId: string, propertyIds: readonly string[], period: PortfolioPeriod): Promise<readonly PortfolioPropertySource[]>;
}

export type BuildPortfolioProjectionQuery = Readonly<{
  access: WorkspaceAccessContext | null;
  workspaceId: string;
  period: PortfolioPeriod;
  propertyIds?: readonly string[];
  evaluatedAt?: string;
  evidenceThreshold?: number;
}>;

export interface PortfolioReadRepository {
  buildPortfolioProjection(query: BuildPortfolioProjectionQuery): Promise<PortfolioProjection>;
  getPortfolioProjection(query: BuildPortfolioProjectionQuery): Promise<PortfolioProjection>;
}

export class PortfolioReadError extends Error {
  constructor(readonly code: "ANONYMOUS_DENIED" | "CROSS_WORKSPACE_DENIED" | "PORTFOLIO_ACCESS_DENIED" | "INVALID_PROPERTY_FILTER", message: string) {
    super(message);
    this.name = "PortfolioReadError";
  }
}

function authorizationScope(access: WorkspaceAccessContext, requested: readonly string[] | undefined): PortfolioAuthorizationScope {
  if (requested?.length === 1) return { type: "single-property", role: access.role };
  if (requested?.length) return { type: "filtered-portfolio", role: access.role };
  if (access.role === "owner" || access.role === "administrator") return { type: "workspace", role: access.role };
  return { type: "assigned-properties", role: access.role as "operator" | "contributor" | "viewer" };
}

export async function resolvePortfolioScope(source: PortfolioProjectionSource, query: BuildPortfolioProjectionQuery): Promise<PortfolioScope> {
  const access = query.access;
  if (!access) throw new PortfolioReadError("ANONYMOUS_DENIED", "Authentication is required to read a portfolio.");
  if (access.workspaceId !== query.workspaceId) throw new PortfolioReadError("CROSS_WORKSPACE_DENIED", "Portfolio access cannot cross workspace boundaries.");
  if (!evaluateWorkspacePermission(access, "intelligence.view")) throw new PortfolioReadError("PORTFOLIO_ACCESS_DENIED", "Portfolio Intelligence access is not permitted.");

  const catalog = await source.listWorkspaceProperties(query.workspaceId);
  const requested = query.propertyIds ? [...new Set(query.propertyIds)] : undefined;
  const catalogIds = new Set(catalog.map(({ propertyId }) => propertyId));
  if (requested?.some((id) => !catalogIds.has(id))) throw new PortfolioReadError("INVALID_PROPERTY_FILTER", "A requested property is outside the workspace.");
  const propertyIds = catalog
    .filter(({ included }) => included)
    .map(({ propertyId }) => propertyId)
    .filter((id) => evaluatePropertyAccess(access, id))
    .filter((id) => !requested || requested.includes(id))
    .sort();
  return Object.freeze({
    propertyIds: Object.freeze(propertyIds),
    propertyCount: propertyIds.length,
    authorization: authorizationScope(access, requested),
  });
}

const evidenceKinds: readonly PortfolioEvidenceKind[] = ["revenue", "market", "bookings", "operational", "financial", "data-quality", "investment", "workspace"];

export async function buildPortfolioProjection(source: PortfolioProjectionSource, query: BuildPortfolioProjectionQuery): Promise<PortfolioProjection> {
  assertPortfolioPeriod(query.period);
  const scope = await resolvePortfolioScope(source, query);
  // This is intentionally the first call that may load metrics or evidence.
  const sources = scope.propertyIds.length ? await source.loadAuthorizedProperties(query.workspaceId, scope.propertyIds, query.period) : [];
  const authorized = new Set(scope.propertyIds);
  if (sources.some(({ propertyId }) => !authorized.has(propertyId))) throw new PortfolioReadError("PORTFOLIO_ACCESS_DENIED", "A source returned a property outside the resolved authorization scope.");
  const properties = sources.map((property): PortfolioPropertyProjection => Object.freeze({
    ...property,
    contribution: Object.freeze({
      revenue: property.metrics.grossRevenue,
      netOperatingIncome: property.metrics.netOperatingIncome,
      bookings: property.metrics.bookingCount,
      actions: property.metrics.openActions,
      operationalIssues: property.metrics.operationalIssues,
      evidenceCount: property.evidence.length,
    }),
  }));
  const evidence = properties.flatMap(({ evidence }) => evidence);
  const threshold = query.evidenceThreshold ?? 1;
  const covered = new Set(evidence.flatMap((item) => item.propertyId ? [item.propertyId] : [])).size;
  const freshness = aggregatePortfolioFreshness(properties.map(({ freshness: value }) => value));
  const confidence = aggregatePortfolioConfidence(properties.map(({ confidence: value }) => value));
  const generatedAt = query.evaluatedAt ?? new Date().toISOString();
  const state = !properties.length ? "no-portfolio" : evidence.length < threshold || covered < properties.length ? "insufficient-evidence" : "ready";
  const lowEvidence = state === "insufficient-evidence" ? [{
    id: `portfolio:${query.workspaceId}:low-evidence`,
    kind: "low-evidence" as const,
    statement: "Portfolio evidence is below the configured threshold or does not cover every included property.",
    observedAt: generatedAt,
    evidenceIds: evidence.map(({ id }) => id),
  }] : [];
  const observations = [...properties.flatMap(({ observations }) => observations), ...lowEvidence];
  const counts = Object.fromEntries(evidenceKinds.map((kind) => [kind, evidence.filter((item) => item.kind === kind).length])) as Record<PortfolioEvidenceKind, number>;
  return Object.freeze({
    identity: Object.freeze({ workspaceId: query.workspaceId, scope, evaluatedAt: generatedAt }),
    scope,
    period: query.period,
    state,
    summary: Object.freeze({
      propertyCount: properties.length,
      activeProperties: properties.filter(({ status }) => status === "active").length,
      archivedProperties: properties.filter(({ status }) => status === "archived").length,
      includedProperties: properties.length,
      marketsRepresented: Object.freeze([...new Set(properties.flatMap(({ market }) => market ? [market] : []))].sort()),
      operatingModels: Object.freeze([...new Set(properties.flatMap(({ operatingModel }) => operatingModel ? [operatingModel] : []))].sort()),
      freshness,
      evidenceConfidence: confidence,
    }),
    performance: aggregatePortfolioMetrics(properties),
    properties: Object.freeze(properties),
    observations: Object.freeze(observations),
    evidence: Object.freeze({ items: Object.freeze(evidence), counts: Object.freeze(counts), propertyCoverage: properties.length ? covered / properties.length : 0, evidenceThreshold: threshold }),
    confidence: properties.length ? confidence : ConfidenceLevel.VERY_LOW,
    freshness: properties.length ? freshness : "unknown" as DataFreshness,
    generatedAt,
  });
}
