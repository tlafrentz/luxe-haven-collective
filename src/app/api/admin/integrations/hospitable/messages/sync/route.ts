import { NextResponse } from "next/server";
import {
  authorizeHospitableSyncRequest,
  MESSAGE_SYNC_ALREADY_RUNNING_ERROR,
  syncHospitableMessages,
} from "@/features/integrations/hospitable";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

export async function POST(request:Request){
  const authorization=await authorizeHospitableSyncRequest(request);
  if(!authorization.authorized){
    const status=authorization.reason==="unauthenticated"?401:403;
    return NextResponse.json({success:false,error:status===401?"Authentication required.":"Administrator access required."},{status,headers:{"Cache-Control":"no-store"}});
  }
  try{
    const result=await syncHospitableMessages({mode:"manual"});
    return NextResponse.json({success:true,result},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const conflict=error instanceof Error&&error.message===MESSAGE_SYNC_ALREADY_RUNNING_ERROR;
    console.error("Hospitable message sync failed",{errorType:error instanceof Error?error.message:"unexpected"});
    return NextResponse.json({success:false,error:conflict?MESSAGE_SYNC_ALREADY_RUNNING_ERROR:"The Hospitable message sync could not be completed. Review sync history or server logs for details."},{status:conflict?409:500,headers:{"Cache-Control":"no-store"}});
  }
}
