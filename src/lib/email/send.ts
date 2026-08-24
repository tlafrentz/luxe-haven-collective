import { Resend } from "resend";
import { resolveFurnishingActivation } from "@/features/furnishing-studio/activation";

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  productFamily?: "furnishing" | "hpm" | "guidebook_studio" | "investment_intelligence";
};

export async function sendEmail({ to, subject, html, replyTo, productFamily }: SendEmailArgs) {
  if (productFamily === "furnishing") {
    const decision = resolveFurnishingActivation({ globalKillSwitch: true, globalState: "disabled", workspaceKillSwitch: false, workspaceEnabled: false, cohortEligible: false, capabilityEnabled: false, configurationValid: true, policyVersion: "fs008a-v1" });
    if (!decision.allowed) throw new Error(`FURNISHING_NOTIFICATION_${decision.reason.toUpperCase()}`);
  }
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
