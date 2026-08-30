import { RoomPackageDetailV2 } from "@/components/furnishing/room-packages-v2";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ packageId: string; versionId: string }> }) { const route = await params; return <RoomPackageDetailV2 packageId={route.packageId} mode="version" versionId={route.versionId} />; }
