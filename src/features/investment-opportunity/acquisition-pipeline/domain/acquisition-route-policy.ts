import type { InvestmentOpportunityRoute } from "@/features/investment-opportunity/domain";
import { AcquisitionDomainError } from "./errors";

export function isSupportedAcquisitionPipelineRoute(route: unknown): route is InvestmentOpportunityRoute { return route === "purchase" || route === "rental-arbitrage"; }
export function assertSupportedAcquisitionPipelineRoute(route: unknown): asserts route is InvestmentOpportunityRoute { if (!isSupportedAcquisitionPipelineRoute(route)) throw new AcquisitionDomainError("UNSUPPORTED_ACQUISITION_ROUTE", { route: typeof route === "string" ? route : undefined }); }
export function assertAcquisitionRouteMatches(expected: InvestmentOpportunityRoute, actual: InvestmentOpportunityRoute): void { if (expected !== actual) throw new AcquisitionDomainError("ACQUISITION_ROUTE_MISMATCH", { expected, actual }); }
