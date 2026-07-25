import type { DataFreshness, PortfolioEvidenceKind, PortfolioProjection } from "@/features/portfolio";
import type { ConfidenceLevel } from "@/platform/scoring";
import type { PortfolioPropertyComparison } from "../property-comparison";
import type { PortfolioComposition } from "../composition";

export type PortfolioRiskCategory = "revenue"|"financial"|"market"|"operational"|"concentration"|"property"|"execution"|"data-quality"|"provider"|"regulatory";
export type PortfolioOpportunityCategory = "revenue"|"pricing"|"occupancy"|"operations"|"guest-experience"|"capital"|"market"|"expansion"|"diversification"|"data";
export type RiskSeverity = "critical"|"high"|"moderate"|"low"|"informational";
export type OpportunitySize = "transformational"|"material"|"incremental"|"minor";
export type FindingHorizon = "immediate"|"near-term"|"medium-term"|"long-term"|"strategic";
export type FindingImpactDimension = "revenue"|"noi"|"operational"|"guest"|"portfolio-resilience";
export type FindingEffort = "low"|"moderate"|"high"|"unknown";
export type FindingEvidence = Readonly<{
  id:string; kind:PortfolioEvidenceKind; statement:string; source:"portfolio"|"property-comparison"|"composition"|"operational-data-quality"|"market-intelligence"|"action-center";
  observedAt:string; confidence:ConfidenceLevel; propertyId?:string;
}>;
export type PortfolioDependency = Readonly<{
  type:"property"|"market"|"operating-model"|"booking-source"|"initiative"|"provider";
  id:string; label:string; share?:number; affectedPropertyIds:readonly string[];
}>;
export type FindingImpact = Readonly<{
  dimension:FindingImpactDimension; direction:"downside"|"upside"; magnitude:"portfolio-material"|"multi-property"|"property-specific"|"unquantified";
  estimatedAmount?:number; basis:string; assumptions:readonly string[];
}>;
export type FindingPriority = Readonly<{
  impact:"critical"|"high"|"moderate"|"low"; confidence:ConfidenceLevel;
  urgency:"immediate"|"near-term"|"monitor"; scope:"portfolio"|"multi-property"|"property";
  evidenceStrength:"strong"|"supported"|"limited"; rationale:readonly string[];
}>;
export type FindingInvestigation = Readonly<{
  label:string; destination:string; type:"property"|"market"|"evidence"|"operations"|"data-quality"|"composition"|"comparison";
}>;
type SharedFinding = Readonly<{
  id:string; title:string; description:string; affectedPropertyIds:readonly string[];
  affectedMarkets:readonly string[]; affectedOperatingModels:readonly string[];
  impact:FindingImpact; confidence:ConfidenceLevel; horizon:FindingHorizon;
  evidence:readonly FindingEvidence[]; dependencies:readonly PortfolioDependency[];
  priority:FindingPriority; freshness:DataFreshness; assumptions:readonly string[];
  investigations:readonly FindingInvestigation[]; detectedAt:string;
}>;
export type PortfolioRisk = SharedFinding & Readonly<{kind:"risk";category:PortfolioRiskCategory;severity:RiskSeverity}>;
export type PortfolioOpportunity = SharedFinding & Readonly<{kind:"opportunity";category:PortfolioOpportunityCategory;size:OpportunitySize;effort:FindingEffort}>;
export type PortfolioFinding = PortfolioRisk|PortfolioOpportunity;
export type PortfolioFindings = Readonly<{
  identity:PortfolioProjection["identity"];scopeLabel:string;period:PortfolioProjection["period"];
  risks:readonly PortfolioRisk[];opportunities:readonly PortfolioOpportunity[];
  prioritized:readonly PortfolioFinding[];dependencies:readonly PortfolioDependency[];
  evidence:readonly FindingEvidence[];state:"ready"|"empty"|"insufficient-evidence"|"degraded";
  limitations:readonly string[];confidence:ConfidenceLevel;freshness:DataFreshness;evaluatedAt:string;
}>;
export type PortfolioFindingsPolicy = Readonly<{
  version:string;minimumEvidenceCoverage:number;materialRevenueDecline:number;
  materialOccupancyDeclinePoints:number;materialRevenueGrowth:number;
  materialConcentrationStatus:readonly ("highly-concentrated"|"critical-dependency")[];
  highBurdenShare:number;lowRevenueShare:number;maximumPerKind:number;
}>;
export type BuildPortfolioFindingsQuery = Readonly<{
  projection:PortfolioProjection;comparison:PortfolioPropertyComparison;composition:PortfolioComposition;
}>;
