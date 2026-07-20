import { AcquisitionType } from "../../domain";
import type { InvestmentDecision, InvestmentWorkspaceView, RentalArbitrageInvestmentAnalysis } from "../../domain";
import { mapInvestmentPlatformAnalysis } from "./map-investment-platform-analysis";

/** The sole canonical-to-UI projection boundary for purchase underwriting. */
export function buildInvestmentWorkspaceView(
  projection: InvestmentDecision | RentalArbitrageInvestmentAnalysis,
  now?: Date,
): InvestmentWorkspaceView {
  if (projection.acquisitionType === AcquisitionType.RentalArbitrage) {
    return Object.freeze({ projection });
  }
  return Object.freeze({ projection, platform: mapInvestmentPlatformAnalysis(projection, now) });
}
