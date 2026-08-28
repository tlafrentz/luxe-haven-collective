// Run: node scripts/check-guidebook-creation-flags.mjs
// Prints only booleans (never the raw values) for the flags that gate
// the customer-facing AI auto-create path, pulled fresh from Vercel
// production so we're checking the real deployed values.
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { config } from "dotenv";

const tmpFile = ".env.guidebook-creation-check.local";
execSync(`npx vercel env pull ${tmpFile} --environment production --yes`, { stdio: "inherit" });
config({ path: tmpFile });

console.log("GUIDEBOOK_CREATION_ENABLED === 'true':", process.env.GUIDEBOOK_CREATION_ENABLED === "true");
console.log("GUIDEBOOK_CREATION_KILL_SWITCH === 'true':", process.env.GUIDEBOOK_CREATION_KILL_SWITCH === "true");
console.log("GUIDEBOOK_CREATION_ADAPTER === 'openai-direct':", process.env.GUIDEBOOK_CREATION_ADAPTER === "openai-direct");
console.log("GUIDEBOOK_CREATION_ADAPTER === 'vercel-ai-gateway':", process.env.GUIDEBOOK_CREATION_ADAPTER === "vercel-ai-gateway");
console.log("GUIDEBOOK_CREATION_VERTICAL_SLICE_VERIFIED === 'true':", process.env.GUIDEBOOK_CREATION_VERTICAL_SLICE_VERIFIED === "true");
console.log("GUIDEBOOK_CREATION_EXTRACTION_MODEL === 'gpt-5-nano':", process.env.GUIDEBOOK_CREATION_EXTRACTION_MODEL === "gpt-5-nano");
console.log("GUIDEBOOK_CREATION_GENERATION_MODEL === 'gpt-5-mini':", process.env.GUIDEBOOK_CREATION_GENERATION_MODEL === "gpt-5-mini");
console.log("OPENAI_API_KEY present:", Boolean(process.env.OPENAI_API_KEY));

unlinkSync(tmpFile);
