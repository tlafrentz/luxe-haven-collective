import {redirect} from "next/navigation";
export default async function Page({params,searchParams}:{params:Promise<{guidebookId:string}>;searchParams:Promise<{viewport?:string}>}){const{guidebookId}=await params,{viewport}=await searchParams;redirect(`/dashboard/guidebooks/${guidebookId}/preview?viewport=${viewport??"desktop"}`)}
