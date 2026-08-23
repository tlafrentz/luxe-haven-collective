import { notFound } from "next/navigation";
import { getExecutePlanAction, getExecutePlanHistoryAction } from "@/app/actions/execute-plans";
import { ActionPlanWorkspace } from "@/features/action-center";

export default async function ExecuteActionPlanPage({ params }: Readonly<{ params: Promise<{ planId: string }> }>) {
  const { planId } = await params;
  const [plan, history] = await Promise.all([getExecutePlanAction({ planId }), getExecutePlanHistoryAction({ planId })]);
  if (!plan.ok) {
    if (plan.code === "PLAN_NOT_FOUND") notFound();
    return <main className="mx-auto max-w-3xl px-5 py-16"><p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">{plan.message}</p></main>;
  }
  return <ActionPlanWorkspace history={history.ok ? history.value : []} plan={plan.value} />;
}
