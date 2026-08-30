import { permanentRedirect } from "next/navigation";
export default async function Page({params}:{params:Promise<{importId:string}>}){permanentRedirect(`/admin/furnishing/imports/${encodeURIComponent((await params).importId)}`)}
