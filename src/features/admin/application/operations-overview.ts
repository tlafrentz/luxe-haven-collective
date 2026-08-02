import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminCustomer = Readonly<{
  id: string;
  name: string;
  email: string | null;
  propertyCount: number;
  joinedAt: string | null;
  status: "active";
}>;

/**
 * Customer is the admin-facing projection of a canonical owner profile. No
 * dashboard-specific entity is persisted. Status remains active until the
 * platform introduces a canonical owner lifecycle.
 */
export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  const client = await createClient();
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
  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.full_name?.trim() || "Unnamed customer",
    email: profile.email,
    propertyCount: counts.get(profile.id) ?? 0,
    joinedAt: profile.created_at,
    status: "active" as const,
  }));
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
