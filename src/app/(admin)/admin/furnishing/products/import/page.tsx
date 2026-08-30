import { permanentRedirect } from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams,workspace=params.workspaceId??params.workspace;permanentRedirect(`/admin/furnishing/imports/new${workspace?`?workspace=${encodeURIComponent(workspace)}`:""}`)}
