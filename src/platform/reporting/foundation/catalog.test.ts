import { describe, expect, it } from "vitest";
import { listAvailableCatalogDefinitions, REPORT_EXCLUDED_METRICS, REPORT_METRIC_SOURCE_MATRIX, STANDARD_REPORT_CATALOG, standardReportCatalog, validateCustomCatalogSelection, validateInvestmentComparisonCatalogInput } from ".";

describe("RP-001B standard report catalog", () => {
  it("defines the six approved products with unique versions and complete context", () => {
    expect(STANDARD_REPORT_CATALOG.map(item => item.definitionId)).toEqual(["executive.performance-brief.v1", "owner.performance-report.v1", "investment.analysis-report.v1", "investment.comparison-report.v1", "operations.performance-report.v1", "custom.report.v1"]);
    expect(new Set(STANDARD_REPORT_CATALOG.map(item => `${item.definitionId}:${item.definitionVersion}`)).size).toBe(6);
    expect(new Set(STANDARD_REPORT_CATALOG.map(item => item.family))).toEqual(new Set(["executive", "owner", "investment", "operations", "custom"]));
    expect(STANDARD_REPORT_CATALOG.every(item => item.audience.length && item.businessQuestion && item.supportedScopes.length)).toBe(true);
  });

  it("fixes deterministic unique section order and all content states", () => {
    for (const definition of STANDARD_REPORT_CATALOG) {
      const keys = definition.sectionDefinitions.map(section => section.key), orders = definition.sectionDefinitions.map(section => section.order);
      expect(new Set(keys).size).toBe(keys.length); expect(orders).toEqual(orders.map((_, index) => index));
      expect(definition.sectionDefinitions.every(section => Object.keys(section.contentStates).length === 8)).toBe(true);
    }
    expect(standardReportCatalog.get("executive.performance-brief.v1").sectionDefinitions.map(section => section.key)).toEqual(["executive-summary", "portfolio-health", "revenue-performance", "property-performance", "risks-opportunities", "decisions", "execution-progress", "outcomes-learning", "executive-priorities", "data-quality-limitations"]);
  });

  it("maps every referenced metric to an authoritative owner and read boundary", () => {
    const mappings = new Map(REPORT_METRIC_SOURCE_MATRIX.map(item => [item.metricKey, item]));
    for (const definition of STANDARD_REPORT_CATALOG) for (const section of definition.sectionDefinitions) for (const key of section.metricKeys) {
      const mapping = mappings.get(key); expect(mapping, `${definition.definitionId}/${section.key}/${key}`).toBeDefined();
      expect(mapping?.authoritativeOwner).toBeTruthy(); expect(mapping?.readBoundary).toBeTruthy(); expect(mapping?.reportDefinitionIds).toContain(definition.definitionId);
    }
    expect(REPORT_METRIC_SOURCE_MATRIX.filter(item => item.availability === "available").every(item => item.readBoundary.length > 0)).toBe(true);
    expect(STANDARD_REPORT_CATALOG.flatMap(item => item.dataRequirements).filter(item => item.availability === "unsupported").every(item => !item.required)).toBe(true);
  });

  it("enforces owner-safe disclosure and excludes internal lifecycle metrics", () => {
    const owner = standardReportCatalog.get("owner.performance-report.v1"), ownerMetricKeys = new Set(owner.sectionDefinitions.flatMap(section => section.metricKeys));
    expect(owner.visibilityPolicy.allowed).toEqual(["owner_safe"]); expect(owner.sectionDefinitions.every(section => section.visibility === "owner_safe")).toBe(true);
    expect(REPORT_METRIC_SOURCE_MATRIX.filter(item => ownerMetricKeys.has(item.metricKey)).every(item => item.visibility === "owner_safe")).toBe(true);
    expect(ownerMetricKeys.has("critical-attention-count")).toBe(false);
  });

  it("preserves immutable investment-analysis scope without period comparison", () => {
    const analysis = standardReportCatalog.get("investment.analysis-report.v1"), comparison = standardReportCatalog.get("investment.comparison-report.v1");
    expect(analysis.supportedScopes).toEqual(["investment_opportunity"]); expect(analysis.periodPolicy.requirement).toBe("analysis_derived"); expect(analysis.comparisonPolicy).toBe("unsupported");
    expect(comparison.supportedScopes).toEqual(["investment_comparison"]); expect(comparison.periodPolicy.requirement).toBe("analysis_derived"); expect(comparison.comparisonPolicy).toBe("unsupported");
    expect(REPORT_METRIC_SOURCE_MATRIX.filter(item => item.sourceType === "analysis").every(item => item.readBoundary === "buildInvestmentReportSnapshot")).toBe(true);
    expect(validateInvestmentComparisonCatalogInput({ tenantIds: ["t1", "t1"], opportunityIds: ["o1", "o2"], analysisVersionIds: ["a1", "a2"], strategies: ["purchase", "purchase"], currencies: ["USD", "USD"], approvedCurrencyConversion: false }).comparable).toBe(true);
    expect(() => validateInvestmentComparisonCatalogInput({ tenantIds: ["t1", "t2"], opportunityIds: ["o1", "o2"], analysisVersionIds: ["a1", "a2"], strategies: ["purchase", "purchase"], currencies: ["USD", "USD"], approvedCurrencyConversion: false })).toThrow("same-tenant");
  });

  it("bounds custom reports to approved compatible sections and metrics", () => {
    expect(validateCustomCatalogSelection({ scope: "property", sectionKeys: ["performance-snapshot"], metricKeysBySection: { "performance-snapshot": ["gross-revenue"] }, visibility: "owner_safe" })).toEqual(["performance-snapshot"]);
    expect(() => validateCustomCatalogSelection({ scope: "property", sectionKeys: ["portfolio-health"], visibility: "owner_safe" })).toThrow("incompatible");
    expect(() => validateCustomCatalogSelection({ scope: "property", sectionKeys: ["performance-snapshot"], metricKeysBySection: { "performance-snapshot": ["invented-metric"] }, visibility: "owner_safe" })).toThrow("metric is incompatible");
    expect(() => validateCustomCatalogSelection({ scope: "property", sectionKeys: [], visibility: "internal" })).toThrow("require unique");
  });

  it("keeps unsupported and deferred ideas out of live definitions and filters catalog options by authority", () => {
    const live = new Set(STANDARD_REPORT_CATALOG.flatMap(definition => definition.sectionDefinitions.flatMap(section => section.metricKeys)));
    expect(REPORT_EXCLUDED_METRICS.every(metric => !live.has(metric.metricKey) && ["unsupported", "deferred"].includes(metric.availability))).toBe(true);
    expect(listAvailableCatalogDefinitions({ authenticated: false, permissions: STANDARD_REPORT_CATALOG.flatMap(item => item.requiredPermissions) })).toEqual([]);
    expect(listAvailableCatalogDefinitions({ authenticated: true, permissions: ["reports.owner.read"] }).map(item => item.definitionId)).toEqual(["owner.performance-report.v1"]);
  });
});
