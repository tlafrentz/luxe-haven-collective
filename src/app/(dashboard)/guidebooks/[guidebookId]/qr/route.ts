import {redirect} from "next/navigation";
export async function GET(_request:Request,{params}:{params:Promise<{guidebookId:string}>}){redirect(`/dashboard/guidebooks/${(await params).guidebookId}/share`)}
