import { RoomPackageDetailV2 } from "@/components/furnishing/room-packages-v2";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ packageId: string }> }) { return <RoomPackageDetailV2 packageId={(await params).packageId} mode="review" />; }
