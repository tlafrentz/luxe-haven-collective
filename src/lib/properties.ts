import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/types/database";

const propertySelect = "id, owner_id, name, slug, headline, short_description, description, property_type, address, neighborhood, city, state, bedrooms, bathrooms, max_guests, nightly_rate, cleaning_fee, service_fee, tax_rate, minimum_nights, check_in_time, check_out_time, amenities, highlights, house_rules, images, featured_image, seo_title, seo_description, status, created_at, updated_at, published_at";

export async function getPublishedProperties() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(propertySelect)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Property[];
}

export async function getAllPropertiesForAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(propertySelect)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Property[];
}

export async function getPublishedPropertyBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(propertySelect)
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !data) notFound();
  return data as Property;
}

export async function getPropertyByIdForAdmin(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(propertySelect)
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  return data as Property;
}

export function propertyImage(property: Pick<Property, "featured_image" | "images">) {
  return property.featured_image || property.images?.[0] || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1600&auto=format&fit=crop";
}
