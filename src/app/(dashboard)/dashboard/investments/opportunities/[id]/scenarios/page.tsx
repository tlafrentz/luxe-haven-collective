import { notFound } from "next/navigation";
import { getInvestmentScenarioWorkspaceRequest } from "@/app/actions/investment-scenario-runtime";
import { InvestmentScenarioWorkspaceView } from "@/features/investment-opportunity/components";

export default async function InvestmentScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getInvestmentScenarioWorkspaceRequest(id);
  if (!result.ok) notFound();
  return <InvestmentScenarioWorkspaceView workspace={result.workspace} />;
}
