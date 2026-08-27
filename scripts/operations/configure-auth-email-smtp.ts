import { readFileSync } from "node:fs";
import { Resend } from "resend";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "jumdtoraygqaraditnie";
const domainName = "auth.luxehavencollective.co";
const credentialName = "luxe-haven-production-supabase-auth-smtp-v1";
const tokenFileIndex = process.argv.indexOf("--supabase-token-file");
const tokenFile = tokenFileIndex >= 0 ? process.argv[tokenFileIndex + 1] : null;

async function main() {
  const setupKey = process.env.RESEND_SETUP_API_KEY;
  const supabaseToken =
    process.env.SUPABASE_ACCESS_TOKEN ??
    (tokenFile ? readFileSync(tokenFile, "utf8").trim() : null);
  if (!setupKey) throw new Error("RESEND_SETUP_API_KEY_REQUIRED");
  if (!supabaseToken) throw new Error("SUPABASE_MANAGEMENT_TOKEN_REQUIRED");

  const resend = new Resend(setupKey);
  const domains = await resend.domains.list();
  if (domains.error)
    throw new Error(`RESEND_DOMAIN_LIST_FAILED:${domains.error.name}`);
  const domain = domains.data?.data.find(({ name }) => name === domainName);
  if (!domain || domain.status !== "verified")
    throw new Error("RESEND_AUTH_DOMAIN_NOT_VERIFIED");
  const detail = await resend.domains.get(domain.id);
  if (detail.error)
    throw new Error(`RESEND_DOMAIN_READ_FAILED:${detail.error.name}`);
  if (detail.data?.open_tracking || detail.data?.click_tracking)
    throw new Error("RESEND_AUTH_TRACKING_MUST_BE_DISABLED");

  const keys = await resend.apiKeys.list();
  if (keys.error) throw new Error(`RESEND_KEY_LIST_FAILED:${keys.error.name}`);
  if (keys.data?.data.some(({ name }) => name === credentialName))
    throw new Error("RESEND_SMTP_CREDENTIAL_ALREADY_EXISTS");

  const credential = await resend.apiKeys.create({
    name: credentialName,
    permission: "sending_access",
    domain_id: domain.id,
  });
  if (credential.error)
    throw new Error(
      `RESEND_SMTP_CREDENTIAL_CREATE_FAILED:${credential.error.name}`,
    );

  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${supabaseToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_email_enabled: true,
      external_anonymous_users_enabled: false,
      mailer_autoconfirm: false,
      mailer_secure_email_change_enabled: true,
      smtp_admin_email: "accounts@auth.luxehavencollective.co",
      smtp_sender_name: "Luxe Haven Collective",
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: credential.data.token,
      rate_limit_email_sent: 30,
    }),
  });
  if (!response.ok) {
    const rawReason = await response.text();
    const safeReason = rawReason
      .replace(/re_[A-Za-z0-9_-]+/g, "[REDACTED]")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 500);
    await resend.apiKeys.remove(credential.data.id);
    throw new Error(
      `SUPABASE_SMTP_CONFIGURATION_FAILED:${response.status}:${safeReason}`,
    );
  }

  const verification = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${supabaseToken}` },
  });
  if (!verification.ok)
    throw new Error(`SUPABASE_SMTP_VERIFICATION_FAILED:${verification.status}`);
  const config = (await verification.json()) as Record<string, unknown>;
  process.stdout.write(
    `${JSON.stringify(
      {
        configuredAt: new Date().toISOString(),
        projectRef,
        resendCredential: {
          id: credential.data.id,
          name: credentialName,
          permission: "sending_access",
          domainId: domain.id,
          secretPrinted: false,
          secretPersistedOutsideSupabase: false,
        },
        smtp: {
          customEnabled: Boolean(config.smtp_host),
          host: config.smtp_host,
          port: config.smtp_port,
          username: config.smtp_user,
          passwordConfigured: Boolean(config.smtp_pass),
          senderAddress: config.smtp_admin_email,
          senderName: config.smtp_sender_name,
        },
        controls: {
          publicEmailSignupEnabled: config.external_email_enabled,
          emailConfirmationEnabled: config.mailer_autoconfirm === false,
          secureEmailChangeEnabled: config.mailer_secure_email_change_enabled,
          anonymousSigninEnabled: config.external_anonymous_users_enabled,
          emailRateLimitPerHour: config.rate_limit_email_sent,
          authenticationEmailSent: false,
        },
      },
      null,
      2,
    )}\n`,
  );
}

void main();
