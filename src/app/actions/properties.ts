"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { propertySchema } from "@/lib/validations/property";

type ActionState = { ok: boolean; message: string; errors?: Record<string, string[]> };

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createPropertyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = propertySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const values = parsed.data;
  const payload = { ...values, published_at: values.status === "active" ? new Date().toISOString() : null };
  const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/stays");
  revalidatePath("/admin/properties");
  redirect(`/admin/properties/${data.id}`);
}

export async function updatePropertyAction(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = propertySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const values = parsed.data;
  const payload = { ...values, published_at: values.status === "active" ? new Date().toISOString() : null };
  const { error } = await supabase.from("properties").update(payload).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/stays");
  revalidatePath(`/stays/${values.slug}`);
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}`);
}

export async function deletePropertyAction(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("properties").update({ status: "archived" }).eq("id", id);
  revalidatePath("/stays");
  revalidatePath("/admin/properties");
}
