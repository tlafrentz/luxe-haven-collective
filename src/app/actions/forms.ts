"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { contactConfirmationHtml, contactNotificationHtml, leadConfirmationHtml, leadNotificationHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { contactInquirySchema, leadMagnetSchema } from "@/lib/validations/forms";

export type FormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const initialError = "Something went wrong. Please try again or email us directly.";

function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function submitContactInquiry(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactInquirySchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const input = parsed.data;
  const supabase = createAdminClient();

  try {
    if (supabase) {
      const { error } = await supabase.from("contact_inquiries").insert({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        inquiry_type: input.inquiryType,
        property_market: input.propertyMarket || null,
        message: input.message,
        source: "contact_page"
      });

      if (error) throw error;
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured. Skipping contact inquiry insert.");
    }

    const notificationTo = process.env.CONTACT_TO_EMAIL;
    if (notificationTo) {
      await sendEmail({
        to: notificationTo,
        subject: `New Luxe Haven inquiry: ${input.inquiryType}`,
        html: contactNotificationHtml(input),
        replyTo: input.email
      });
    }

    await sendEmail({
      to: input.email,
      subject: "We received your Luxe Haven inquiry",
      html: contactConfirmationHtml(input)
    });

    return { ok: true, message: "Thank you — your inquiry has been received. We’ll review it and follow up soon." };
  } catch (error) {
    console.error("Contact inquiry submission failed", error);
    return { ok: false, message: initialError };
  }
}

export async function submitLeadMagnet(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = leadMagnetSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const input = parsed.data;
  const supabase = createAdminClient();

  try {
    if (supabase) {
      const { error } = await supabase.from("lead_magnet_downloads").insert({
        name: input.name,
        email: input.email,
        property_market: input.propertyMarket,
        property_status: input.propertyStatus,
        lead_magnet: "str_revenue_readiness_checklist"
      });

      if (error) throw error;
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured. Skipping lead magnet insert.");
    }

    const notificationTo = process.env.CONTACT_TO_EMAIL;
    if (notificationTo) {
      await sendEmail({
        to: notificationTo,
        subject: "New Luxe Haven checklist download",
        html: leadNotificationHtml(input),
        replyTo: input.email
      });
    }

    await sendEmail({
      to: input.email,
      subject: "Your STR Revenue Readiness Checklist",
      html: leadConfirmationHtml(input)
    });

    return { ok: true, message: "Success — check your inbox for the checklist link." };
  } catch (error) {
    console.error("Lead magnet submission failed", error);
    return { ok: false, message: initialError };
  }
}
