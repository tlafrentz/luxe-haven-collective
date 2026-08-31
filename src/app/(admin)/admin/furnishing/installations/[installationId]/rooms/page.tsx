import { TrackingDetail } from "@/components/furnishing/delivery-installation-v2";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{installationId:string}>}){return <TrackingDetail id={(await params).installationId} section="rooms"/>}
