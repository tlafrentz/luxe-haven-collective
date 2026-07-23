import { notFound } from "next/navigation";
import { getAcquisitionWorkspaceRequestContext } from "@/app/actions/acquisition-workspace-query-runtime";
import { createInvestmentOpportunityId } from "@/features/investment-opportunity/domain";
import { AcquisitionOpportunityWorkspace } from "@/features/investment-opportunity/components/acquisition-opportunity-workspace";

export default async function InvestmentOpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let opportunityId;
  try { opportunityId = createInvestmentOpportunityId(id); } catch { notFound(); }
  const context = await getAcquisitionWorkspaceRequestContext();
  if (!context.ok) notFound();
  const result = await context.handler.execute({ ownerId: context.ownerId, actor: context.actor, opportunityId });
  if (result.isFailure) {
    if (["ACQUISITION_WORKSPACE_NOT_AUTHENTICATED", "ACQUISITION_WORKSPACE_NOT_AUTHORIZED", "ACQUISITION_WORKSPACE_NOT_FOUND"].includes(result.error.code)) notFound();
    throw new Error("The investment opportunity workspace could not be loaded.");
  }
  return <AcquisitionOpportunityWorkspace workspace={result.value} />;
}
