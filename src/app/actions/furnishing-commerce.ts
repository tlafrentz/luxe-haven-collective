"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SupabaseWorkspaceRepository } from "@/features/workspace/infrastructure/supabase-workspace-repository";

export type FurnishingAccountActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

const schema = z
  .object({
    email: z.string().email("Please enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
    next: z.string().startsWith("/furnishing/purchase/"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function createFurnishingAccountAction(
  _: FurnishingAccountActionState,
  formData: FormData,
): Promise<FurnishingAccountActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password, next } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: "owner" } },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: true,
      message:
        "Account created. Check your email to confirm your sign-in, then sign in to continue.",
    };
  }

  const workspaceRepository = new SupabaseWorkspaceRepository();
  await workspaceRepository.initializeOwner(user.id);

  redirect(next);
}
