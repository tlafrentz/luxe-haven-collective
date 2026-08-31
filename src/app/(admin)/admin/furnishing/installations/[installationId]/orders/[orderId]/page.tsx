import { TrackingDetail } from "@/components/furnishing/delivery-installation-v2";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{installationId:string;orderId:string}>}){const p=await params;return <TrackingDetail id={p.installationId} section="order" entityId={p.orderId}/>}
