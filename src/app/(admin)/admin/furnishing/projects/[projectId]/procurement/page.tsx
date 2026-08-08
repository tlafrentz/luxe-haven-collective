import { ProcurementWorkspace } from "@/components/furnishing/procurement-workspace";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{view?:string}>}){const[{projectId},query]=await Promise.all([params,searchParams]);return <ProcurementWorkspace projectId={projectId} view={query.view}/>}
