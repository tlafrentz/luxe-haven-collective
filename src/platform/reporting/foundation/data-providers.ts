import type { ReportFamily } from "./model";
import type { AuthorizedGenerationInput, ReportDataProvider, ReportProviderRegistry, ReportSourceData } from "./generation";

/**
 * Adapts existing application read boundaries to Reporting without transferring
 * ownership of calculations or permitting direct provider access.
 */
export type CanonicalReportLoader = (input: AuthorizedGenerationInput) => Promise<ReportSourceData>;

export class ExecutiveReportDataAdapter implements ReportDataProvider { constructor(private readonly loadCanonicalExecutiveData: CanonicalReportLoader) {} load(input: AuthorizedGenerationInput) { return this.loadCanonicalExecutiveData(input); } }
export class OwnerReportDataAdapter implements ReportDataProvider { constructor(private readonly loadCanonicalOwnerData: CanonicalReportLoader) {} load(input: AuthorizedGenerationInput) { return this.loadCanonicalOwnerData(input); } }
export class InvestmentReportDataAdapter implements ReportDataProvider {
  constructor(private readonly loadSavedInvestmentAnalysis: CanonicalReportLoader) {}
  async load(input: AuthorizedGenerationInput) {
    const result = await this.loadSavedInvestmentAnalysis(input);
    const required = input.scope.kind === "investment_opportunity" ? [input.scope.analysisVersionId] : input.scope.kind === "investment_comparison" ? input.scope.analysisVersionIds : [];
    const returned = new Set(Object.values(result.metrics).flatMap(value => value.lineage).filter(item => item.sourceType === "investment_analysis").map(item => item.sourceVersionId).filter((value): value is string => Boolean(value)));
    if (required.some(version => !returned.has(version))) throw new Error("The canonical investment boundary did not return every requested immutable analysis version.");
    return result;
  }
}
export class OperationsReportDataAdapter implements ReportDataProvider { constructor(private readonly loadCanonicalOperationsData: CanonicalReportLoader) {} load(input: AuthorizedGenerationInput) { return this.loadCanonicalOperationsData(input); } }
export class CustomReportDataAdapter implements ReportDataProvider { constructor(private readonly loadApprovedComponents: CanonicalReportLoader) {} load(input: AuthorizedGenerationInput) { return this.loadApprovedComponents(input); } }

export class CanonicalReportProviderRegistry implements ReportProviderRegistry {
  constructor(private readonly providers: Readonly<Record<ReportFamily, ReportDataProvider>>) {}
  get(family: ReportFamily) { return this.providers[family]; }
}
