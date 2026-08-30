import { FurnishingOverview } from "@/components/furnishing/furnishing-overview";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ workspace?: string; workspaceId?: string }> }) { const query = await searchParams; return <FurnishingOverview workspaceId={query.workspaceId ?? query.workspace} />; }
