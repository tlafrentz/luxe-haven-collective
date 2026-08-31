import { TrackingDetail } from "@/components/furnishing/delivery-installation-v2";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{installationId:string;roomId:string}>}){const p=await params;return <TrackingDetail id={p.installationId} section="rooms" entityId={p.roomId}/>}
