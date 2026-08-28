"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SupabaseWorkspaceRepository } from "@/features/workspace/infrastructure/supabase-workspace-repository";
import { authorizePublicAuth, isRateLimitError, publicAuthMessage, recordAuthEmailRequest, recordAuthOperationalAlert } from "@/lib/auth/public-auth";

export type GuidebookAccountActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  correlationId?: string;
  retryAfterSeconds?: number;
};

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name."),
    email: z.string().email("Please enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
    next: z.string().startsWith("/guidebook-studio/purchase/"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function createGuidebookAccountAction(
  _: GuidebookAccountActionState,
  formData: FormData,
): Promise<GuidebookAccountActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { fullName, email, password, next } = parsed.data;
  const decision = await authorizePublicAuth("signup", formData, email);
  if (!decision.allowed) return { ok: false, message: publicAuthMessage(decision.code), correlationId: decision.correlationId };
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { captchaToken: decision.captchaToken, data: { full_name: fullName, role: "owner" } },
  });

  if (error) {
    if (isRateLimitError(error)) await recordAuthOperationalAlert("auth_rate_limited", decision.correlationId);
    return { ok: false, message: isRateLimitError(error) ? "Too many requests. Please wait before trying again." : "We couldn't complete that request. Please try again.", correlationId: decision.correlationId, ...(isRateLimitError(error) ? { retryAfterSeconds: 60 } : {}) };
  }
  await recordAuthEmailRequest("confirmation", email, decision.correlationId);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: true,
      message:
        "Account created. Check your email to confirm your sign-in, then sign in to continue.",
      correlationId: decision.correlationId,
    };
  }

  const workspaceRepository = new SupabaseWorkspaceRepository();
  await workspaceRepository.initializeOwner(user.id);

  redirect(next);
}
