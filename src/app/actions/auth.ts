"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, "Enter your full name."),
  role: z.enum(["guest", "owner"]).default("guest")
});

const forgotPasswordSchema = z.object({ email: z.string().email("Enter a valid email.") });
const updatePasswordSchema = z.object({ password: z.string().min(8, "Password must be at least 8 characters.") });

export type AuthActionState = { ok?: boolean; message?: string; errors?: Record<string, string[]> };

function toFormErrors(error: z.ZodError): AuthActionState {
  return { ok: false, errors: error.flatten().fieldErrors };
}

export async function signInAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFormErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single<{ role: UserRole }>();

  revalidatePath("/", "layout");
  redirect(roleHome[profile?.role ?? "guest"]);
}

export async function registerAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFormErrors(parsed.error);

  const supabase = await createClient();
  const { email, password, fullName, role } = parsed.data;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } }
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Account created. Check your email to confirm your sign-in." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFormErrors(parsed.error);

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password reset email sent." };
}

export async function updatePasswordAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFormErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
