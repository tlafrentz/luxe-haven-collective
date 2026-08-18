import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminCustomer = Readonly<{
  id: string;
  name: string;
  email: string | null;
  propertyCount: number;
  joinedAt: string | null;
  status: "active";
  lifecycleStage: string;
  programId: string | null;
  program: string | null;
  cohort: string | null;
  nextAction: string | null;
}>;

/**
 * Customer is the admin-facing projection of a canonical owner profile. No
 * dashboard-specific entity is persisted. Status remains active until the
 * platform introduces a canonical owner lifecycle.
 */
export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  const client = createAdminClient();
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id,full_name,email,created_at")
    .eq("role", "owner")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load customers.");

  const { data: properties, error: propertyError } = await client
    .from("properties")
    .select("owner_id");
  if (propertyError) throw new Error("Unable to load customer property counts.");
  const counts = new Map<string, number>();
  for (const property of properties ?? []) {
    if (property.owner_id) counts.set(property.owner_id, (counts.get(property.owner_id) ?? 0) + 1);
  }
  const profileCustomers=(profiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.full_name?.trim() || "Unnamed customer",
    email: profile.email,
    propertyCount: counts.get(profile.id) ?? 0,
    joinedAt: profile.created_at,
    status: "active" as const,
    lifecycleStage:"active",programId:null,program:null,cohort:null,nextAction:null,
  }));
  const {data:accounts,error:accountError}=await client.from("customer_accounts").select("id,display_name,primary_email,created_at,lifecycle_stage,customer_programs(id,program_type,cohort,next_action)").not("primary_email","is",null).order("created_at",{ascending:false});
  if(accountError&&!/column|relation/i.test(accountError.message))throw new Error("Unable to load commercial customer accounts.");
  const accountCustomers=(accounts??[]).map(account=>{const programs=(account.customer_programs??[])as unknown as Array<{id:string;program_type:string;cohort:string;next_action:string|null}>;const program=programs[0];return{id:String(account.id),name:String(account.display_name??"Unnamed customer"),email:account.primary_email?String(account.primary_email):null,propertyCount:0,joinedAt:String(account.created_at),status:"active" as const,lifecycleStage:String(account.lifecycle_stage??"prospect"),programId:program?.id??null,program:program?.program_type==="FOUNDING_HPM_PARTNER"?"Founding HPM Partner":program?.program_type??null,cohort:program?.cohort??null,nextAction:program?.next_action??null}});
  const accountEmails=new Set(accountCustomers.map(x=>x.email?.toLowerCase()).filter(Boolean));
  return[...accountCustomers,...profileCustomers.filter(x=>!x.email||!accountEmails.has(x.email.toLowerCase()))];
}

export async function getWorkspaceCounts() {
  const client = await createClient();
  const [customers, properties, activeBookings, inquiries] = await Promise.all([
    client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner"),
    client.from("properties").select("id", { count: "exact", head: true }),
    client.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    client.from("contact_inquiries").select("id", { count: "exact", head: true }).in("status", ["new", "reviewed"]),
  ]);
  return {
    customers: customers.error ? null : customers.count,
    properties: properties.error ? null : properties.count,
    activeBookings: activeBookings.error ? null : activeBookings.count,
    supportInquiries: inquiries.error ? null : inquiries.count,
  };
}
