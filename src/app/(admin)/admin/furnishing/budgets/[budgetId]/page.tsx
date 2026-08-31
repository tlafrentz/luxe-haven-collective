import { BudgetDetail } from "@/components/furnishing/design-workspaces-v2";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ budgetId: string }> }) { return <BudgetDetail id={(await params).budgetId} />; }
