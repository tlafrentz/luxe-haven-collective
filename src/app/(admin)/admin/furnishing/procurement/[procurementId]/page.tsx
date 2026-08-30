import { ProcurementWorkspace } from "@/components/furnishing/procurement-workspace";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ procurementId: string }>; searchParams: Promise<{ view?: string }> }) { const [{ procurementId }, query] = await Promise.all([params, searchParams]); return <ProcurementWorkspace projectId={procurementId} view={query.view} />; }
