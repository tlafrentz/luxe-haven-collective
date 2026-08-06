"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SupabaseWorkspaceRepository } from "@/features/workspace/infrastructure/supabase-workspace-repository";
import { plansBySlug, type PlanSlug } from "@/lib/plans";
import { track } from "@/lib/analytics/track";

const commerceAccountSchema = z
  .object({
    email: z.string().email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
    termsAccepted: z.literal("on", { message: "You must accept the Terms of Service and Privacy Policy." }),
    plan: z.string(),
    billing: z.enum(["monthly", "annual"]),
    workspaceDraft: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type CommerceAccountActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

function toFormErrors(error: z.ZodError): CommerceAccountActionState {
  return { ok: false, errors: error.flatten().fieldErrors };
}

const workspaceDraftSchema = z.object({
  businessType: z.enum(["individual-owner", "co-host", "small-portfolio", "enterprise"]),
  propertyCount: z.enum(["1", "2-5", "6-20", "20+"]),
  primaryGoal: z.enum(["increase-revenue", "guest-experience", "launch-property", "investment", "operations"]),
  integrations: z.array(z.string()).optional(),
  preferredOnboardingDate: z.string().optional(),
});

export async function createCommerceAccountAction(
  _prevState: CommerceAccountActionState,
  formData: FormData,
): Promise<CommerceAccountActionState> {
  const parsed = commerceAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return toFormErrors(parsed.error);
  }

  const { email, password, plan: planSlug, billing, workspaceDraft } = parsed.data;

  if (!plansBySlug[planSlug as PlanSlug]) {
    return { ok: false, message: "The selected plan could not be found." };
  }

  const draftParsed = workspaceDraftSchema.safeParse(JSON.parse(workspaceDraft || "{}"));
  if (!draftParsed.success) {
    return { ok: false, message: "Please configure your workspace before creating an account." };
  }

  const supabase = await createClient();

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: "owner" } },
  });

  if (signUpError) {
    return { ok: false, message: signUpError.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: true,
      message:
        "Account created. Check your email to confirm your sign-in, then return here and sign in to continue.",
    };
  }

  const workspaceRepository = new SupabaseWorkspaceRepository();
  const identity = await workspaceRepository.initializeOwner(user.id);

  const { error: profileError } = await supabase.from("commerce_business_profiles").upsert(
    {
      profile_id: user.id,
      workspace_id: identity.workspaceId,
      business_type: draftParsed.data.businessType,
      property_count: draftParsed.data.propertyCount,
      primary_goal: draftParsed.data.primaryGoal,
      integrations: draftParsed.data.integrations ?? [],
      preferred_onboarding_date: draftParsed.data.preferredOnboardingDate || null,
      plan_slug: planSlug,
      billing_cycle: billing,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );

  if (profileError) {
    return { ok: false, message: "We couldn't save your workspace details. Please try again." };
  }

  track("account_created", { plan: planSlug, billing });

  redirect(`/commerce/review?plan=${planSlug}&billing=${billing}`);
}
