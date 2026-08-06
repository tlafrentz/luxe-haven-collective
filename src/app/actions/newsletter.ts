"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { newsletterSchema } from "@/lib/validations/forms";
import type { FormState } from "@/app/actions/forms";

export async function subscribeToNewsletterAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please enter a valid email address.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email } = parsed.data;

  try {
    const supabase = createAdminClient();

    if (supabase) {
      const { error } = await supabase.from("contact_inquiries").insert({
        name: "Newsletter subscriber",
        email,
        inquiry_type: "newsletter",
        message: "Subscribed via the Resources hub newsletter signup.",
        source: "resources_newsletter",
        status: "new",
        metadata: { submitted_from: "resources_hub" },
      });

      if (error) {
        throw error;
      }
    } else {
      console.warn(
        "SUPABASE_SERVICE_ROLE_KEY is not configured. Skipping newsletter signup insert.",
      );
    }

    return {
      ok: true,
      message: "You're subscribed. Watch your inbox for our next update.",
    };
  } catch (error) {
    console.error("Newsletter signup failed", error);

    return {
      ok: false,
      message: "Something went wrong. Please try again.",
    };
  }
}
