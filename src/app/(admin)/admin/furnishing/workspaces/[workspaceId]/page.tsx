import { DesignWorkspaceDetail } from "@/components/furnishing/design-workspaces-v2";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ workspaceId: string }> }) { return <DesignWorkspaceDetail id={(await params).workspaceId} />; }
