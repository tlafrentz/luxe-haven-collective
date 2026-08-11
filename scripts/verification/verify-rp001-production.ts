import { createHash } from "node:crypto";
const base = process.env.RP001_VERIFY_BASE_URL,
  confirm = process.env.RP001_VERIFY_CONFIRM_PRODUCTION;
if (
  confirm !== "I_CONFIRM_CONTROLLED_PRODUCTION_VERIFICATION" ||
  base !== "https://luxehavencollective.co"
)
  throw new Error(
    "Explicit controlled production confirmation and the approved production URL are required.",
  );
const roles = [
  "ADMIN",
  "OPERATOR",
  "OWNER",
  "WRONG_TENANT",
  "DIFFERENT_OWNER",
  "NO_ACCESS",
  "REVOKED",
] as const;
const missing = roles.filter(
  (role) => !process.env[`RP001_VERIFY_${role}_ACCESS_TOKEN`],
);
if (missing.length)
  throw new Error(
    `Controlled access tokens are missing for role classes: ${missing.join(", ")}.`,
  );
const results: Record<string, { status: number; redirected: boolean }> =
  Object.create(null);
for (const role of roles) {
  const response = await fetch(`${base}/dashboard/reports`, {
    headers: {
      authorization: `Bearer ${process.env[`RP001_VERIFY_${role}_ACCESS_TOKEN`]!}`,
    },
    redirect: "manual",
  });
  results[role.toLowerCase()] = {
    status: response.status,
    redirected: response.status >= 300 && response.status < 400,
  };
}
const anonymous = await fetch(`${base}/dashboard/reports`, {
  redirect: "manual",
});
results.anonymous = {
  status: anonymous.status,
  redirected: anonymous.status >= 300 && anonymous.status < 400,
};
console.log(
  JSON.stringify({
    schemaVersion: 1,
    target: createHash("sha256").update(base).digest("hex").slice(0, 12),
    verifiedAt: new Date().toISOString(),
    roles: results,
  }),
);
