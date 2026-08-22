import { understandRoutes } from "./understand-routes";

export type IntelligenceActionKind = "navigation" | "command" | "drawer" | "modal" | "external" | "disabled";
export type IntelligenceActionContract = Readonly<{
  id: string;
  source: "observe-revenue" | "observe-financial" | "understand-executive" | "understand-portfolio";
  label: string;
  kind: IntelligenceActionKind;
  outcome: string;
}>;

export const intelligenceActionContracts: readonly IntelligenceActionContract[] = Object.freeze([
  { id: "executive-export", source: "understand-executive", label: "Export", kind: "modal", outcome: "intelligence-report-dialog" },
  { id: "executive-attention", source: "understand-executive", label: "Review Attention", kind: "navigation", outcome: understandRoutes.attention },
  { id: "portfolio-export", source: "understand-portfolio", label: "Export", kind: "modal", outcome: "intelligence-report-dialog" },
  { id: "portfolio-signals", source: "understand-portfolio", label: "Inspect supporting signals", kind: "drawer", outcome: "portfolio-supporting-signals" },
  { id: "portfolio-data-quality", source: "understand-portfolio", label: "Review data quality", kind: "navigation", outcome: understandRoutes.portfolioDataQuality },
  { id: "portfolio-property", source: "understand-portfolio", label: "Review property", kind: "navigation", outcome: "canonical-property-intelligence-route" },
  { id: "revenue-export", source: "observe-revenue", label: "Export", kind: "modal", outcome: "intelligence-report-dialog" },
  { id: "financial-export", source: "observe-financial", label: "Export", kind: "modal", outcome: "intelligence-report-dialog" },
]);

