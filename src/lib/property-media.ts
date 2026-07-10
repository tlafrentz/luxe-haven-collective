import { createClient } from "@/lib/supabase/server";
import type { PropertyMedia } from "@/types/database";

export async function getPropertyMedia(propertyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("property_media")
    .select("id, property_id, storage_path, url, alt_text, sort_order, is_featured, created_at")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PropertyMedia[];
}
