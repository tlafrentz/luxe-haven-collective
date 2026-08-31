import { DesignWorkspaceSection } from "@/components/furnishing/design-workspaces-v2";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ workspaceId: string }> }) { return <DesignWorkspaceSection id={(await params).workspaceId} section="rooms" />; }
