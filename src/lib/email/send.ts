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
    throw new Error("Email delivery is not configured.");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from, to, subject, html, replyTo });

  if (result.error) {
    throw new Error(`Email delivery failed: ${result.error.message}`);
  }

  return result.data;
}
