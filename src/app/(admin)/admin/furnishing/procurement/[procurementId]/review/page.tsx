import { ProcurementDetail } from "@/components/furnishing/procurement-readiness-v2";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{procurementId:string}>}){return <ProcurementDetail id={(await params).procurementId} section="review"/>}
