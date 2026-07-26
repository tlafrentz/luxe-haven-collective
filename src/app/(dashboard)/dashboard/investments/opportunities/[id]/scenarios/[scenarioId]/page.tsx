import { notFound } from "next/navigation";
import { getInvestmentScenarioWorkspaceRequest } from "@/app/actions/investment-scenario-runtime";
import { InvestmentScenarioDetail } from "@/features/investment-opportunity/components/investment-scenario-workspace";

export default async function InvestmentScenarioPage({ params }: { params: Promise<{ id: string; scenarioId: string }> }) {
  const { id, scenarioId } = await params;
  const result = await getInvestmentScenarioWorkspaceRequest(id);
  if (!result.ok) notFound();
  const scenario = result.workspace.scenarios.find(({ id: value }) => value === scenarioId);
  if (!scenario) notFound();
  return <InvestmentScenarioDetail scenario={scenario} aggregateVersion={result.workspace.aggregateVersion} />;
}
