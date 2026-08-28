import { notFound } from "next/navigation";
import { getExecutePlanAction, getExecutePlanHistoryAction } from "@/app/actions/execute-plans";
import { ActionPlanWorkspace } from "@/features/action-center";
import { decodeActionPlanPathId } from "@/features/action-center/domain/action-plan-route";

export default async function ExecuteActionPlanPage({ params,searchParams }: Readonly<{ params: Promise<{ planId: string }>;searchParams:Promise<{workspace?:string;from?:string}> }>) {
  const { planId } = await params;
  const query=await searchParams;
  const canonicalPlanId=decodeActionPlanPathId(planId);
  if (!canonicalPlanId) notFound();
  const [plan, history] = await Promise.all([getExecutePlanAction({ planId:canonicalPlanId,workspaceId:query.workspace }), getExecutePlanHistoryAction({ planId:canonicalPlanId,workspaceId:query.workspace })]);
  if (!plan.ok) {
    if (plan.code === "PLAN_NOT_FOUND") notFound();
    return <main className="mx-auto max-w-3xl px-5 py-16"><p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">{plan.message}</p></main>;
  }
  return <ActionPlanWorkspace backContext={query.from} history={history.ok ? history.value : []} plan={plan.value} />;
}
