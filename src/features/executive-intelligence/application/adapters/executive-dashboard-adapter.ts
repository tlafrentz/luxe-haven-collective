import type { AnalyticsQueryParams } from "@/features/analytics";

import type { ExecutiveIntelligenceReport } from "../../domain";
import { getExecutiveIntelligence } from "../get-executive-intelligence";

/** Temporary dashboard compatibility provider. The dashboard has one Executive projection boundary. */
export function getExecutiveDashboardProjection(
  input: AnalyticsQueryParams & { generatedAt?: string },
): Promise<ExecutiveIntelligenceReport> {
  return getExecutiveIntelligence(input);
}
