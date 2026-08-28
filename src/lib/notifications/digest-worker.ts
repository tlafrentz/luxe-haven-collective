import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recipientDigest } from "@/lib/auth/public-auth";
import { sendEmail } from "@/lib/email/send";
import { digestPeriod } from "@/features/workspace/domain/notification-digest";
import type { NotificationFrequency } from "@/features/workspace/domain/notifications-preferences";

type Row = Record<string, unknown>;
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]!);
const canonicalUrl = (value: unknown) => { const path=String(value??""); return path.startsWith("/dashboard/")&&!path.startsWith("//")?path:undefined; };

export async function processDueNotificationDigests(now = new Date(), limit = 25) {
  const admin = createAdminClient();
  const { data: preferences, error } = await admin.from("user_notification_preferences").select("workspace_id,profile_id,channels,subscriptions,digest,timezone,confirmed").eq("confirmed",true).limit(500);
  if (error) throw new Error("NOTIFICATION_DIGEST_PREFERENCES_UNAVAILABLE");
  let sent=0,claimed=0,skipped=0;
  for (const preference of (preferences??[]) as Row[]) {
    if (sent>=limit) break;
    if (!(preference.channels as Row)?.email) { skipped++; continue; }
    const workspaceId=String(preference.workspace_id),profileId=String(preference.profile_id),timezone=String(preference.timezone),subscriptions=(preference.subscriptions??[]) as Row[],digest=preference.digest as {frequency:"daily"|"weekly"|"off";day:number;time:string};
    const { data: membership } = await admin.from("workspace_memberships").select("id").eq("workspace_id",workspaceId).eq("profile_id",profileId).eq("status","active").maybeSingle();
    if (!membership) { skipped++; continue; }
    const { data: profile } = await admin.from("profiles").select("email").eq("id",profileId).maybeSingle();
    const email=String(profile?.email??"").trim().toLowerCase(); if(!email){skipped++;continue;}
    const digestValue=recipientDigest(email);
    const { data: suppression }=await admin.from("auth_email_suppressions").select("id").eq("recipient_digest",digestValue).eq("active",true).maybeSingle();
    if(suppression){skipped++;continue;}
    const groups = new Map<string, { period: NonNullable<ReturnType<typeof digestPeriod>>; categories: string[] }>();
    for (const subscription of subscriptions) {
      if (!Array.isArray(subscription.channels) || !subscription.channels.includes("email")) continue;
      const frequency=String(subscription.frequency) as NotificationFrequency;
      const period=digestPeriod({now,timezone,frequency,digest}); if(!period)continue;
      const key=`${period.frequency}:${period.periodKey}`;
      const group=groups.get(key)??{period,categories:[]}; group.categories.push(String(subscription.category)); groups.set(key,group);
    }
    for (const {period,categories} of groups.values()) {
      const { data: notifications }=await admin.from("notifications").select("id,category,title,body,action_url,created_at").eq("workspace_id",workspaceId).eq("recipient_profile_id",profileId).in("category",categories).eq("status","unread").order("created_at").limit(100);
      if(!notifications?.length)continue;
      const ids=notifications.map((item)=>item.id);
      const correlationId=randomUUID();
      const {data:claim,error:claimError}=await admin.rpc("claim_notification_digest",{p_workspace_id:workspaceId,p_profile_id:profileId,p_frequency:period.frequency,p_period_key:period.frequency==="immediate"?`${period.periodKey}:${ids.join(",")}`:period.periodKey,p_timezone:timezone,p_scheduled_for:now.toISOString(),p_notification_ids:ids,p_recipient_digest:digestValue,p_correlation_id:correlationId});
      if(claimError)throw new Error("NOTIFICATION_DIGEST_CLAIM_FAILED");
      const result=claim as {claimed:boolean;requestId?:string}; if(!result.claimed){skipped++;continue;} claimed++;
      const items=notifications.map((item)=>{const url=canonicalUrl(item.action_url);return `<li><strong>${escape(item.title)}</strong><br>${escape(item.body)}${url?`<br><a href="${escape(new URL(url,process.env.NEXT_PUBLIC_SITE_URL??"https://luxehavencollective.co").toString())}">Open in Luxe Haven</a>`:""}</li>`;}).join("");
      try {
        const handoff=await sendEmail({to:email,subject:`Luxe Haven notification ${period.frequency==="immediate"?"update":"digest"}`,html:`<h1>Your Luxe Haven notifications</h1><p>${escape(timezone)} · ${escape(period.frequency)} delivery</p><ul>${items}</ul>`});
        await admin.rpc("transition_notification_digest",{p_request_id:result.requestId!,p_status:"sent",p_provider_message_id:handoff?.id??null,p_diagnostic_code:null});
        await admin.from("notification_deliveries").upsert(ids.map((notificationId)=>({notification_id:notificationId,channel:"email",status:"queued",attempted_at:now.toISOString(),retry_count:0})),{onConflict:"notification_id,channel"});
        sent++;
      } catch {
        await admin.rpc("transition_notification_digest",{p_request_id:result.requestId!,p_status:"failed",p_provider_message_id:null,p_diagnostic_code:"PROVIDER_HANDOFF_FAILED"});
      }
    }
  }
  return {processed:true,claimed,sent,skipped};
}
