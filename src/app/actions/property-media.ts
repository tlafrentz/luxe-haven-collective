"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "property-images";

async function syncPropertyImages(propertyId: string) {
  const supabase = await createClient();

  const { data: media, error } = await supabase
    .from("property_media")
    .select("url, is_featured")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const imageUrls = (media ?? []).map((item) => item.url);
  const featured =
    (media ?? []).find((item) => item.is_featured)?.url ?? imageUrls[0] ?? null;

  const { error: updateError } = await supabase
    .from("properties")
    .update({
      image_urls: imageUrls,
      featured_image_url: featured,
    })
    .eq("id", propertyId);

  if (updateError) throw new Error(updateError.message);
}

export async function uploadPropertyImagesAction(formData: FormData) {
  await requireRole(["admin"]);

  const propertyId = String(formData.get("property_id") ?? "");
  const files = formData.getAll("images").filter((file): file is File => file instanceof File);

  if (!propertyId || files.length === 0) return;

  const supabase = await createClient();

  const { count } = await supabase
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  let sortOrder = count ?? 0;

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `${propertyId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { error: insertError } = await supabase.from("property_media").insert({
      property_id: propertyId,
      storage_path: storagePath,
      url: data.publicUrl,
      alt_text: file.name.replace(/\.[^/.]+$/, ""),
      sort_order: sortOrder,
      is_featured: sortOrder === 0,
    });

    if (insertError) throw new Error(insertError.message);

    sortOrder += 1;
  }

  await syncPropertyImages(propertyId);

  revalidatePath(`/admin/properties/${propertyId}/edit`);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/admin/properties");
  revalidatePath("/stays");
}

export async function setFeaturedPropertyImageAction(formData: FormData) {
  await requireRole(["admin"]);

  const propertyId = String(formData.get("property_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");

  if (!propertyId || !mediaId) return;

  const supabase = await createClient();

  await supabase
    .from("property_media")
    .update({ is_featured: false })
    .eq("property_id", propertyId);

  const { error } = await supabase
    .from("property_media")
    .update({ is_featured: true })
    .eq("id", mediaId)
    .eq("property_id", propertyId);

  if (error) throw new Error(error.message);

  await syncPropertyImages(propertyId);

  revalidatePath(`/admin/properties/${propertyId}/edit`);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/stays");
}

export async function deletePropertyImageAction(formData: FormData) {
  await requireRole(["admin"]);

  const propertyId = String(formData.get("property_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");

  if (!propertyId || !mediaId) return;

  const supabase = await createClient();

  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from("property_media")
    .delete()
    .eq("id", mediaId)
    .eq("property_id", propertyId);

  if (error) throw new Error(error.message);

  await syncPropertyImages(propertyId);

  revalidatePath(`/admin/properties/${propertyId}/edit`);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/admin/properties");
  revalidatePath("/stays");
}

export async function movePropertyImageAction(formData: FormData) {
  await requireRole(["admin"]);

  const propertyId = String(formData.get("property_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (!propertyId || !mediaId || !["up", "down"].includes(direction)) return;

  const supabase = await createClient();

  const { data: media, error } = await supabase
    .from("property_media")
    .select("id, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  if (!media) return;

  const currentIndex = media.findIndex((item) => item.id === mediaId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= media.length) return;

  const current = media[currentIndex];
  const target = media[targetIndex];

  await supabase
    .from("property_media")
    .update({ sort_order: target.sort_order })
    .eq("id", current.id);

  await supabase
    .from("property_media")
    .update({ sort_order: current.sort_order })
    .eq("id", target.id);

  await syncPropertyImages(propertyId);

  revalidatePath(`/admin/properties/${propertyId}/edit`);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/stays");
}
