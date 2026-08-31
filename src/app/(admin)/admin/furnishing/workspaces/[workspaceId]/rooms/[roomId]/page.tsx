import { DesignWorkspaceSection } from "@/components/furnishing/design-workspaces-v2";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ workspaceId: string; roomId: string }> }) { const p = await params; return <DesignWorkspaceSection id={p.workspaceId} roomId={p.roomId} section="rooms" />; }
