import { Identifier } from "../../kernel";

export type IntelligenceReportId = Identifier;
export type InsightId = Identifier;
export type TrendId = Identifier;
export type OpportunityId = Identifier;
export type ForecastId = Identifier;
export type AnomalyId = Identifier;
function create(prefix: string, value?: string): Identifier { return Identifier.create(value ?? `${prefix}-${crypto.randomUUID()}`); }
export const createIntelligenceReportId = (value?: string): IntelligenceReportId => create("intelligence-report", value);
export const createInsightId = (value?: string): InsightId => create("insight", value);
export const createTrendId = (value?: string): TrendId => create("trend", value);
export const createOpportunityId = (value?: string): OpportunityId => create("opportunity", value);
export const createForecastId = (value?: string): ForecastId => create("forecast", value);
export const createAnomalyId = (value?: string): AnomalyId => create("anomaly", value);
