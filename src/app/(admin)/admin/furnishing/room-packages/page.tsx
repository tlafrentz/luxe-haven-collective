import { RoomPackageLibraryV2 } from "@/components/furnishing/room-packages-v2";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) { return <RoomPackageLibraryV2 searchParams={searchParams} />; }
