import Link from "next/link";
import { FinancialExpenseForm } from "@/features/financial-intelligence/presentation/financial-expense-form";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";

export default async function NewFinancialExpensePage(){
  const{user}=await getSessionProfile();if(!user)return<main className="p-8">Sign in to record expenses.</main>;
  const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id),client=await createClient();
  const[{data:properties},{data:owner}]=await Promise.all([
    client.from("properties").select("id,name").eq("owner_id",access.workspaceId).neq("status","archived").order("name"),
    client.from("owners").select("currency").eq("id",access.workspaceId).single(),
  ]);
  return<main className="mx-auto max-w-4xl space-y-7 px-5 py-10"><header><Link href="/dashboard/financial" className="text-sm font-semibold">← Financial Overview</Link><p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Canonical financial observation</p><h1 className="mt-2 text-4xl font-semibold">Record operating expense</h1><p className="mt-3 text-stone-600">Actuals, projections, scenarios, and budgets remain separately identified. Every entry retains its category, period, source, and evidence reference.</p></header><FinancialExpenseForm workspaceId={access.workspaceId} properties={(properties??[]).map(item=>({id:String(item.id),name:String(item.name)}))} currency={owner?.currency??"USD"}/></main>
}
