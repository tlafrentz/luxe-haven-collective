import type { ContactInquiryInput, LeadMagnetInput } from "@/lib/validations/forms";

const escape = (value?: string) =>
  (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function contactNotificationHtml(input: ContactInquiryInput) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171412;">
      <h1>New Luxe Haven inquiry</h1>
      <p><strong>Name:</strong> ${escape(input.name)}</p>
      <p><strong>Email:</strong> ${escape(input.email)}</p>
      <p><strong>Phone:</strong> ${escape(input.phone)}</p>
      <p><strong>Inquiry type:</strong> ${escape(input.inquiryType)}</p>
      <p><strong>Property market:</strong> ${escape(input.propertyMarket)}</p>
      <hr />
      <p><strong>Message:</strong></p>
      <p>${escape(input.message).replaceAll("\n", "<br />")}</p>
    </div>
  `;
}

export function contactConfirmationHtml(input: ContactInquiryInput) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171412;">
      <h1>We received your inquiry</h1>
      <p>Hi ${escape(input.name)},</p>
      <p>Thank you for reaching out to Luxe Haven Collective. We received your ${escape(input.inquiryType).toLowerCase()} inquiry and will review the details you shared.</p>
      <p>To help us respond with the strongest next step, you can reply with any property links, photos, current performance notes, or target market details.</p>
      <p>— Luxe Haven Collective</p>
    </div>
  `;
}

export function leadNotificationHtml(input: LeadMagnetInput) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171412;">
      <h1>New checklist download</h1>
      <p><strong>Name:</strong> ${escape(input.name)}</p>
      <p><strong>Email:</strong> ${escape(input.email)}</p>
      <p><strong>Property market:</strong> ${escape(input.propertyMarket)}</p>
      <p><strong>Property status:</strong> ${escape(input.propertyStatus)}</p>
    </div>
  `;
}

export function leadConfirmationHtml(input: LeadMagnetInput) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171412;">
      <h1>Your STR Revenue Readiness Checklist</h1>
      <p>Hi ${escape(input.name)},</p>
      <p>Here is your Luxe Haven Collective checklist: <a href="${siteUrl}/resources/str-revenue-readiness-checklist">Open the checklist</a>.</p>
      <p>Use it to review listing positioning, guest experience, pricing, operations, and owner reporting.</p>
      <p>— Luxe Haven Collective</p>
    </div>
  `;
}
