"use server";

import { getInvestmentOpportunityRequestContext } from "@/app/actions/investment-opportunity-runtime";
import { loadPortfolioWorkspace } from "@/features/investment-opportunity";
import { createClient } from "@/lib/supabase/server";

export async function loadInvestmentOverviewPageData() {
  const context = await getInvestmentOpportunityRequestContext();

  if (!context.ok) {
    return { ok: false as const };
  }

  try {
    const client = await createClient();

    const [view, scenarios] = await Promise.all([
      loadPortfolioWorkspace(context.repository, context.ownerId, { limit: 5 }),
      client
        .from("investment_scenarios")
        .select("scenario_id", { count: "exact", head: true }),
    ]);

    if (scenarios.error) {
      throw scenarios.error;
    }

    return {
      ok: true as const,
      view,
      scenarioCount: scenarios.count ?? 0,
    };
  } catch {
    return { ok: false as const };
  }
}
