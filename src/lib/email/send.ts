import { Resend } from "resend";

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Luxe Haven Collective <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured. Skipping email send.");
    return { skipped: true };
  }

  const resend = new Resend(apiKey);
  return resend.emails.send({ from, to, subject, html, replyTo });
}
