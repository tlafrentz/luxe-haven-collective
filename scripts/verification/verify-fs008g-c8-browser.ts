import { chmod, readFile, rm } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright-core";

type Step = {
  id: string;
  url: string;
  persona: string;
  expected: string;
  stop: string;
};
type Runbook = {
  productionOrigin: string;
  mutationAuthorized: boolean;
  externalEffects: Record<string, boolean>;
  steps: Step[];
};

async function main() {
const origin = process.env.FS008G_BROWSER_ORIGIN;
if (!origin) throw new Error("FS008G_BROWSER_ORIGIN_REQUIRED");
const parsed = new URL(origin);
const isolatedOrigin = origin;
if (!["localhost", "127.0.0.1"].includes(parsed.hostname))
  throw new Error("FS008G_BROWSER_ISOLATED_ORIGIN_REQUIRED");
if (process.env.FS008G_BROWSER_MUTATIONS !== "true")
  throw new Error("FS008G_BROWSER_MUTATION_ACK_REQUIRED");
const credentialPath = process.env.FS008G_BROWSER_CREDENTIAL_FILE;
const stateDirectory = process.env.FS008G_BROWSER_STATE_DIR;
if (!credentialPath) throw new Error("FS008G_BROWSER_CREDENTIAL_FILE_REQUIRED");
if (!stateDirectory) throw new Error("FS008G_BROWSER_STATE_DIR_REQUIRED");
const credentials = JSON.parse(await readFile(credentialPath, "utf8")) as {
  admin: { email: string; password: string; id: string };
  owner: { email: string; password: string; id: string };
  workspaceId: string;
  wrongWorkspaceId: string;
};

const runbook = JSON.parse(
  await readFile("docs/runbooks/fs008g-finalization.json", "utf8"),
) as Runbook;
if (
  runbook.mutationAuthorized ||
  Object.values(runbook.externalEffects).some(Boolean)
)
  throw new Error("FS008G_BROWSER_EXTERNAL_EFFECT_POLICY_INVALID");
const required = [
  "activation",
  "catalog-import",
  "catalog-reconciliation",
  "package-create",
  "package-review",
  "owner-project",
  "snapshot",
  "procurement-baseline",
  "budget",
  "batch-order",
  "receiving",
  "owner-projection",
  "kill-switch-cleanup",
];
if (required.some((id) => !runbook.steps.some((step) => step.id === id)))
  throw new Error("FS008G_BROWSER_RUNBOOK_INCOMPLETE");

const browser = await chromium.launch({
  executablePath: process.env.FS008G_BROWSER_EXECUTABLE_PATH,
  headless: true,
});
const adminState = `${stateDirectory}/admin.json`;
const ownerState = `${stateDirectory}/owner.json`;
const bootstrapAdmin = await browser.newContext();
const bootstrapOwner = await browser.newContext();
const anonymous = await browser.newContext();
const results: Array<{
  id: string;
  status: number;
  refreshed: number;
  denialChecked: boolean;
}> = [];

async function login(page: Page, persona: "admin" | "owner") {
  const identity = credentials[persona];
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(identity.email);
  await page.getByLabel("Password").fill(identity.password);
  await page.locator('input[name="captchaToken"]').evaluate((node) => {
    (node as HTMLInputElement).value = "local-browser-verification";
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("public-auth-captcha", { detail: true })));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((value) => value.pathname !== "/login", { timeout: 30_000 });
}

async function saveState(context: BrowserContext, path: string) {
  await context.storageState({ path });
  await chmod(path, 0o600);
}

function targetFor(step: Step) {
  return new URL(step.url.replace(runbook.productionOrigin, isolatedOrigin)
    .replaceAll("{workspaceId}", credentials.workspaceId)
    .replaceAll("{projectId}", "00000000-0000-4000-8000-000000000008")
    .replaceAll("{packageId}", "00000000-0000-4000-8000-000000000009")
    .replaceAll("{importId}", "00000000-0000-4000-8000-000000000010"));
}

async function visit(context: BrowserContext, step: Step) {
  const page = await context.newPage();
  const target = targetFor(step);
  const response = await page.goto(target.toString(), {
    waitUntil: "domcontentloaded",
  });
  if (!response || response.status() >= 400)
    throw new Error(`${step.id}:ROUTE_FAILED`);
  const refreshed = await page.reload({ waitUntil: "domcontentloaded" });
  if (!refreshed || refreshed.status() >= 400)
    throw new Error(`${step.id}:REFRESH_FAILED`);
  const body = await page.locator("body").innerText();
  if (
    /credential|service_role|idempotency_key|correlation_id/i.test(body) &&
    step.persona === "controlled-owner"
  )
    throw new Error(`${step.id}:CUSTOMER_PROJECTION_LEAK`);
  await page.close();
  return { status: response.status(), refreshed: refreshed.status() };
}

try {
  await login(await bootstrapAdmin.newPage(), "admin");
  await login(await bootstrapOwner.newPage(), "owner");
  await saveState(bootstrapAdmin, adminState);
  await saveState(bootstrapOwner, ownerState);
  const controlledAdmin = await browser.newContext({ storageState: adminState });
  const controlledOwner = await browser.newContext({ storageState: ownerState });
  for (const step of runbook.steps) {
    const context = step.persona === "controlled-admin" ? controlledAdmin : controlledOwner;
    const route = await visit(context, step);
    let denialChecked = false;
    if (
      step.persona === "controlled-owner" ||
      step.persona === "controlled-admin"
    ) {
      const page = await anonymous.newPage();
      await page.goto(targetFor(step).toString(), { waitUntil: "domcontentloaded" });
      denialChecked = new URL(page.url()).pathname === "/login";
      await page.close();
      if (!denialChecked) throw new Error(`${step.id}:ANONYMOUS_ACCESS_ALLOWED`);
    }
    results.push({ id: step.id, ...route, denialChecked });
  }
  await controlledAdmin.close();
  await controlledOwner.close();
  process.stdout.write(
    JSON.stringify(
      {
        status: "passed",
        mode: "isolated-browser",
        steps: results.length,
        externalEffects: 0,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await bootstrapAdmin.close();
  await bootstrapOwner.close();
  await anonymous.close();
  await browser.close();
  await rm(adminState, { force: true });
  await rm(ownerState, { force: true });
}
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
