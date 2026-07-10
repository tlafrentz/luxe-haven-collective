import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type InquiryStatus =
  | "new"
  | "reviewed"
  | "responded"
  | "closed";

export type ContactInquiryRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  inquiry_type: string;
  property_market: string | null;
  message: string;
  source: string;
  status: InquiryStatus;
  metadata: Record<string, unknown>;
  internal_notes: string | null;
  assigned_to: string | null;
  responded_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

const inquirySelect = `
  id,
  name,
  email,
  phone,
  inquiry_type,
  property_market,
  message,
  source,
  status,
  metadata,
  internal_notes,
  assigned_to,
  responded_at,
  closed_at,
  created_at,
  updated_at
`;

export async function getContactInquiries() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_inquiries")
    .select(inquirySelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ContactInquiryRecord[];
}

export async function getContactInquiry(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_inquiries")
    .select(inquirySelect)
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  return data as ContactInquiryRecord;
}

export async function updateContactInquiry(
  id: string,
  updates: Partial<
    Pick<
      ContactInquiryRecord,
      | "status"
      | "internal_notes"
      | "assigned_to"
      | "responded_at"
      | "closed_at"
    >
  >,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_inquiries")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(inquirySelect)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ContactInquiryRecord;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
) {
  const now = new Date().toISOString();

  return updateContactInquiry(id, {
    status,
    responded_at: status === "responded" ? now : null,
    closed_at: status === "closed" ? now : null,
  });
}

export async function updateInquiryNotes(
  id: string,
  internalNotes: string,
) {
  return updateContactInquiry(id, {
    internal_notes: internalNotes.trim() || null,
  });
}
