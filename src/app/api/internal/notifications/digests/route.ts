import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processDueNotificationDigests } from "@/lib/notifications/digest-worker";

export const runtime="nodejs"; export const dynamic="force-dynamic";
function authorized(request:Request){const expected=process.env.NOTIFICATION_DIGEST_SCHEDULER_SECRET??process.env.CRON_SECRET,supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!expected||!supplied)return false;const left=Buffer.from(expected),right=Buffer.from(supplied);return left.length===right.length&&timingSafeEqual(left,right)}
export async function GET(request:Request){if(!authorized(request))return NextResponse.json({ok:false,code:"UNAUTHORIZED"},{status:401});try{return NextResponse.json({ok:true,...await processDueNotificationDigests()});}catch{return NextResponse.json({ok:false,code:"DIGEST_PROCESSING_FAILED"},{status:503});}}
export const POST=GET;
