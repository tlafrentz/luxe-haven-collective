import { ProcurementDetail } from "@/components/furnishing/procurement-readiness-v2";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{procurementId:string;versionId:string}>}){const p=await params;return <ProcurementDetail id={p.procurementId} section="version" versionId={p.versionId}/>}
