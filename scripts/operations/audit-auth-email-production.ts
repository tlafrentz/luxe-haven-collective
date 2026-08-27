import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "jumdtoraygqaraditnie";
const tokenFileIndex = process.argv.indexOf("--token-file");
const tokenFile = tokenFileIndex >= 0 ? process.argv[tokenFileIndex + 1] : null;
const accessToken =
  process.env.SUPABASE_ACCESS_TOKEN ??
  (tokenFile ? readFileSync(tokenFile, "utf8").trim() : null);

if (!accessToken) throw new Error("SUPABASE_MANAGEMENT_TOKEN_REQUIRED");

async function main() {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok)
    throw new Error(`AUTH_CONFIG_AUDIT_FAILED:${response.status}`);

  const config = (await response.json()) as Record<string, unknown>;
  const hash = (value: unknown) =>
    typeof value === "string" && value.length
      ? createHash("sha256").update(value).digest("hex")
      : null;
  const present = (key: string) => {
    const value = config[key];
    return typeof value === "string" ? value.length > 0 : value != null;
  };
  const value = (key: string) => config[key] ?? null;
  const template = (kind: string) => ({
    subject: value(`mailer_subjects_${kind}`),
    contentConfigured: present(`mailer_templates_${kind}`),
    contentSha256: hash(value(`mailer_templates_${kind}`)),
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        projectRef,
        smtp: {
          customEnabled: present("smtp_host"),
          host: value("smtp_host"),
          port: value("smtp_port"),
          userConfigured: present("smtp_user"),
          passwordConfigured: present("smtp_pass"),
          senderName: value("smtp_sender_name"),
          senderAddress: value("smtp_admin_email"),
        },
        authFlows: {
          publicSignupEnabled: value("external_email_enabled"),
          anonymousSigninEnabled: value("external_anonymous_users_enabled"),
          emailAutoconfirm: value("mailer_autoconfirm"),
          secureEmailChange: value("mailer_secure_email_change_enabled"),
          otpExpirySeconds: value("mailer_otp_exp"),
          otpLength: value("mailer_otp_length"),
        },
        urls: {
          siteUrl: value("site_url"),
          allowedRedirectUrls: value("uri_allow_list"),
        },
        captcha: {
          enabled: value("security_captcha_enabled"),
          provider: value("security_captcha_provider"),
          secretConfigured: present("security_captcha_secret"),
        },
        rateLimits: {
          emailSentPerHour: value("rate_limit_email_sent"),
          otpSentPerHour: value("rate_limit_otp"),
          tokenVerification: value("rate_limit_verify"),
          anonymousUsers: value("rate_limit_anonymous_users"),
          emailCooldownSeconds: value("mailer_otp_max_frequency"),
        },
        templates: {
          confirmation: template("confirmation"),
          invitation: template("invitation"),
          recovery: template("recovery"),
          magicLink: template("magic_link"),
          emailChange: template("email_change"),
          reauthentication: template("reauthentication"),
        },
      },
      null,
      2,
    )}\n`,
  );
}

void main();
