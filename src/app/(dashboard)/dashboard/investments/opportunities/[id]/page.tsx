import { notFound } from "next/navigation";
import { getAcquisitionWorkspaceRequestContext } from "@/app/actions/acquisition-workspace-query-runtime";
import { createInvestmentOpportunityId } from "@/features/investment-opportunity/domain";
import { AcquisitionOpportunityWorkspace } from "@/features/investment-opportunity/components/acquisition-opportunity-workspace";
import { getRelevantLearning } from "@/app/actions/platform-learning-workspace";
import { RelevantLearningPanel } from "@/components/learning/relevant-learning-panel";
import Link from "next/link";
import { listInvestmentReportsForOpportunity } from "@/app/actions/investment-reports";

export default async function InvestmentOpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let opportunityId;
  try { opportunityId = createInvestmentOpportunityId(id); } catch { notFound(); }
  const context = await getAcquisitionWorkspaceRequestContext();
  if (!context.ok||!await context.authorizeOpportunity(id,"opportunity.read")) notFound();
  const result = await context.handler.execute({ ownerId: context.ownerId, actor: context.actor, opportunityId });
  if (result.isFailure) {
    if (["ACQUISITION_WORKSPACE_NOT_AUTHENTICATED", "ACQUISITION_WORKSPACE_NOT_AUTHORIZED", "ACQUISITION_WORKSPACE_NOT_FOUND"].includes(result.error.code)) notFound();
    throw new Error("The investment opportunity workspace could not be loaded.");
  }
  const [learning,reports]=await Promise.all([
    getRelevantLearning({capability:"investment",subjectType:"investment-scenario",subjectId:id,strategy:"investment-underwriting"}).catch(()=>null),
    listInvestmentReportsForOpportunity(id),
  ]);
  return <><div className="mx-auto flex max-w-7xl justify-end px-5 pt-5"><Link className="rounded-full border px-4 py-2 text-sm font-semibold" href={result.value.analysis?.historicalAnalysisHref ?? `/dashboard/investments/new?opportunity=${id}&mode=reanalyze`}>{result.value.analysis ? "Review latest analysis" : "Analyze opportunity"}</Link></div><AcquisitionOpportunityWorkspace workspace={result.value} reports={reports ?? []} />{learning?<div className="mx-auto max-w-7xl px-5 pb-10"><RelevantLearningPanel projection={learning} title="Relevant investment learning"/></div>:null}</>;
}
