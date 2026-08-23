import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const envs = { sandbox: PlaidEnvironments.sandbox, development: PlaidEnvironments.development, production: PlaidEnvironments.production } as const;

export function plaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET && process.env.PLAID_ENV && process.env.FINANCIAL_TOKEN_ENCRYPTION_KEY);
}
export function plaidClient() {
  const environment = process.env.PLAID_ENV as keyof typeof envs;
  if (!plaidConfigured() || !envs[environment]) throw new Error("PLAID_NOT_CONFIGURED");
  return new PlaidApi(new Configuration({ basePath: envs[environment], baseOptions: { headers: { "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!, "PLAID-SECRET": process.env.PLAID_SECRET! } } }));
}
export const plaidLinkRequest = (workspaceId: string) => ({
  user: { client_user_id: workspaceId }, client_name: "Luxe Haven Collective",
  products: [Products.Transactions], country_codes: [CountryCode.Us], language: "en",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { webhook: `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/,"")}/api/webhooks/plaid` } : {}),
});
function key() {
  const raw = process.env.FINANCIAL_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("FINANCIAL_TOKEN_ENCRYPTION_KEY_MISSING");
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("FINANCIAL_TOKEN_ENCRYPTION_KEY_INVALID");
  return value;
}
export function encryptFinancialToken(value: string) {
  const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",key(),iv), encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
export function decryptFinancialToken(value: string) {
  const [version,iv,tag,payload]=value.split(".");
  if(version!=="v1"||!iv||!tag||!payload) throw new Error("FINANCIAL_TOKEN_INVALID");
  const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));
  decipher.setAuthTag(Buffer.from(tag,"base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payload,"base64url")),decipher.final()]).toString("utf8");
}
