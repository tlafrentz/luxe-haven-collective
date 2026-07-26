import "server-only";
import {
  createInvestmentOpportunityId,
  createOpportunityOwnerId,
  getInvestmentScenarioWorkspace,
} from "@/features/investment-opportunity";
import { getInvestmentOpportunityRequestContext } from "./investment-opportunity-runtime";

export async function getInvestmentScenarioWorkspaceRequest(opportunityId: string) {
  const context = await getInvestmentOpportunityRequestContext();
  if (!context.ok) return { ok: false as const, code: "SCENARIO_NOT_AUTHENTICATED" as const };
  try {
    const opportunity = await context.repository.findById(
      createInvestmentOpportunityId(opportunityId),
      createOpportunityOwnerId(context.ownerId),
    );
    if (!opportunity) return { ok: false as const, code: "SCENARIO_NOT_FOUND" as const };
    return {
      ok: true as const,
      workspace: getInvestmentScenarioWorkspace(opportunity, {
        actorId: context.ownerId,
        canManage: true,
      }),
    };
  } catch {
    return { ok: false as const, code: "SCENARIO_UNAVAILABLE" as const };
  }
}
