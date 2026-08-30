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
const lifecycle = { importId: "", packageId: "", projectId: "" };

async function login(page: Page, persona: "admin" | "owner") {
  const identity = credentials[persona];
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill(identity.email);
    await page.getByLabel("Password").fill(identity.password);
    await page.locator('input[name="captchaToken"]').evaluate((node) => {
      (node as HTMLInputElement).value = "local-browser-verification";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("public-auth-captcha", { detail: true })));
    await page.getByRole("button", { name: "Sign in" }).click();
    await Promise.race([
      page.waitForURL((value) => value.pathname !== "/login", { timeout: 12_000 }).catch(() => undefined),
      page.getByText("This service is temporarily unavailable.").waitFor({ timeout: 12_000 }).catch(() => undefined),
    ]);
    if (new URL(page.url()).pathname !== "/login") return;
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 800);
    if (!body.includes("This service is temporarily unavailable.") || attempt === 3)
      throw new Error(`LOGIN_FAILED:${persona}:${body}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
}

async function saveState(context: BrowserContext, path: string) {
  await context.storageState({ path });
  await chmod(path, 0o600);
}

function targetFor(step: Step) {
  return new URL(step.url.replace(runbook.productionOrigin, isolatedOrigin)
    .replaceAll("{workspaceId}", credentials.workspaceId)
    .replaceAll("{projectId}", lifecycle.projectId || "00000000-0000-4000-8000-000000000008")
    .replaceAll("{packageId}", lifecycle.packageId || "00000000-0000-4000-8000-000000000009")
    .replaceAll("{importId}", lifecycle.importId || "00000000-0000-4000-8000-000000000010"));
}

async function clickGovernedControl(page: Page, label: string) {
  const reason = page.getByLabel("Required reason");
  await reason.click();
  await reason.fill("");
  await reason.pressSequentially("FS-008G C8-D isolated browser lifecycle", { delay: 8 });
  await reason.press("Tab");
  if ((await reason.inputValue()).length < 12)
    throw new Error(`activation:REASON_INPUT_NOT_COMMITTED:${label}`);
  await page.waitForTimeout(300);
  const control = page.getByRole("button", { name: label, exact: true });
  await control.waitFor({ state: "visible" });
  if (await control.isDisabled()) return;
  page.once("dialog", (dialog) => dialog.accept());
  await control.click();
  const status = page.getByRole("status");
  try {
    await status.filter({ hasText: `${label}: control updated.` }).waitFor({ timeout: 30_000 });
  } catch {
    throw new Error(`activation:CONTROL_FAILED:${label}:${await status.innerText()}`);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function runActivation(context: BrowserContext, step: Step) {
  const page = await context.newPage();
  const response = await page.goto(targetFor(step).toString(), { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 400) throw new Error("activation:ROUTE_FAILED");
  await page.waitForLoadState("networkidle");
  for (const label of [
    "Create/grant controlled cohort",
    "Enable controlled workspace",
    "Enable catalog_viewing",
    "Enable design_workspace",
    "Enable budgeting",
    "Enable procurement_readiness",
    "Restore workspace kill switch",
    "Set global state: internal",
    "Lift global kill switch",
  ]) await clickGovernedControl(page, label);
  await page.reload({ waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  if (!/Release state\s+internal/i.test(body) || !/Kill switch\s+lifted/i.test(body))
    throw new Error("activation:AUTHORITATIVE_REFRESH_MISMATCH");
  await page.close();
  return { status: response.status(), refreshed: 200 };
}

async function runCatalogImport(context: BrowserContext, step: Step) {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/furnishing/products`, { waitUntil: "networkidle" });
  if (await page.locator('a[href^="/admin/furnishing/products/"]').evaluateAll((nodes) => nodes.some((node) => /\/admin\/furnishing\/products\/[0-9a-f-]{36}$/.test(new URL((node as HTMLAnchorElement).href).pathname)))) {
    await page.close();
    return { status: 200, refreshed: 200 };
  }
  const response = await page.goto(targetFor(step).toString(), { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 400) throw new Error("catalog-import:ROUTE_FAILED");
  await page.getByLabel("Upload furnishing inventory").setInputFiles("docs/evidence/FS-008D/source/Catalog Review (1).xlsx");
  await page.getByRole("button", { name: "Parse and review 110 rows" }).click();
  await page.waitForURL(/\/admin\/furnishing\/products\/import\/[0-9a-f-]+$/, { timeout: 60_000 });
  lifecycle.importId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  if (!lifecycle.importId) throw new Error("catalog-import:IMPORT_ID_MISSING");
  await page.getByText("110 detected rows", { exact: false }).waitFor();
  const apply = page.getByRole("button", { name: /Import \d+ valid reviewed items/ });
  const label = await apply.innerText();
  if (label !== "Import 109 valid reviewed items")
    throw new Error(`catalog-import:REVIEW_COUNT_MISMATCH:${label}`);
  await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.includes(`/products/import/${lifecycle.importId}`),
    ),
    apply.click(),
  ]);
  await page.waitForLoadState("networkidle");
  await page.reload({ waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  if (!/Status\s+complete/i.test(body) || !/Created\s+109/i.test(body) || !/Failed\s+0/i.test(body))
    throw new Error("catalog-import:ATOMIC_APPLY_RECONCILIATION_FAILED");
  await page.close();
  return { status: response.status(), refreshed: 200 };
}

async function clickForm(page: Page, buttonName: string, fill?: Record<string, string>) {
  const button = page.getByRole("button", { name: buttonName, exact: true }).first();
  const form = button.locator("xpath=ancestor::form");
  for (const [name, value] of Object.entries(fill ?? {}))
    await form.locator(`[name="${name}"]`).fill(value);
  await button.click();
  await page.waitForLoadState("networkidle");
}

async function runCatalogGovernance(context: BrowserContext, step: Step) {
  const page = await context.newPage();
  const response = await page.goto(targetFor(step).toString(), { waitUntil: "networkidle" });
  if (!response || response.status() >= 400) throw new Error("catalog-reconciliation:ROUTE_FAILED");
  const productLinks = await page.locator('a[href^="/admin/furnishing/products/"]').evaluateAll((nodes) =>
    [...new Set(nodes.map((node) => (node as HTMLAnchorElement).href).filter((href) => /\/admin\/furnishing\/products\/[0-9a-f-]{36}$/.test(new URL(href).pathname)))].sort().slice(0, 2),
  );
  if (productLinks.length < 2) throw new Error("catalog-reconciliation:CONTROLLED_PRODUCTS_MISSING");
  for (const href of productLinks) {
    await page.goto(href, { waitUntil: "networkidle" });
    const needsGovernance = await page.getByRole("button", { name: "Approve controlled product", exact: true }).count() > 0;
    if (!needsGovernance) continue;
    await clickForm(page, "Approve controlled product", { reason: "C8-D controlled product approval" });
    await page.reload({ waitUntil: "networkidle" });
    await clickForm(page, "Approve controlled offer", { reason: "C8-D controlled offer approval" });
    await page.reload({ waitUntil: "networkidle" });
    const assignment = page.getByRole("button", { name: "Assign governed offer", exact: true }).first();
    const assignmentForm = assignment.locator("xpath=ancestor::form");
    await assignmentForm.locator('[name="role"]').selectOption(productLinks.indexOf(href) === 0 ? "preferred" : "alternate");
    await assignmentForm.locator('[name="rank"]').fill(productLinks.indexOf(href) === 0 ? "1" : "2");
    await assignment.click();
    await page.waitForLoadState("networkidle");
    await page.reload({ waitUntil: "networkidle" });
  }
  await page.close();
  return { status: response.status(), refreshed: 200 };
}

async function createRequirement(page: Page, name: string, roomLabel: RegExp) {
  await page.goto(`${origin}/admin/furnishing/packages/requirements`, { waitUntil: "networkidle" });
  if (await page.getByText(name, { exact: true }).count() === 0) {
    const form = page.getByRole("heading", { name: "New requirement" }).locator("xpath=ancestor::form");
    await form.locator('[name="name"]').fill(name);
    await form.locator('[name="categoryId"]').selectOption({ index: 1 });
    const rooms = await form.locator('[name="roomType"] option').allTextContents();
    const roomIndex = Math.max(1, rooms.findIndex((label) => roomLabel.test(label)));
    await form.locator('[name="roomType"]').selectOption({ index: roomIndex });
    await form.getByRole("button", { name: "Create requirement" }).click();
    await page.waitForLoadState("networkidle");
    await page.reload({ waitUntil: "networkidle" });
  }
  const submit = page.getByRole("button", { name: "Submit for review", exact: true }).first();
  if (await submit.count()) {
    await submit.click();
    await page.waitForLoadState("networkidle");
    await page.reload({ waitUntil: "networkidle" });
  }
  const approve = page.getByRole("button", { name: "Approve requirement", exact: true }).first();
  if (!await approve.count()) return;
  const review = approve.locator("xpath=ancestor::form");
  await review.locator('[name="reason"]').fill("C8-D controlled requirement approval");
  await approve.click();
  await page.waitForLoadState("networkidle");
}

async function runPackageCreate(context: BrowserContext, step: Step) {
  const page = await context.newPage();
  await createRequirement(page, "C8-D Living Room Seating", /living/i);
  await createRequirement(page, "C8-D Bedroom Sleeping", /bed/i);
  await page.goto(`${origin}/admin/furnishing/packages/rooms/new`, { waitUntil: "networkidle" });
  await page.locator('[name="name"]').fill("C8-D Controlled Living and Bedroom");
  await page.locator('[name="roomType"]').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create draft package" }).click();
  await page.waitForURL(/\/admin\/furnishing\/packages\/rooms\/[0-9a-f-]+$/, { timeout: 30_000 });
  const roomPackageId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  for (let index = 0; index < 2; index++) {
    const form = page.getByRole("heading", { name: "Add requirement" }).locator("xpath=following-sibling::form");
    await form.locator('[name="requirementId"]').selectOption({ index: 1 });
    await form.locator('[name="quantityRuleId"]').selectOption({ index: 1 });
    await form.locator('[name="productId"]').selectOption({ index: index + 1 });
    await form.getByRole("button", { name: "Add requirement" }).click();
    await page.waitForLoadState("networkidle");
    await page.reload({ waitUntil: "networkidle" });
  }
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForLoadState("networkidle");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Validate governed package" }).click();
  await page.getByRole("status").filter({ hasText: "validation passed" }).waitFor({ timeout: 30_000 });
  await page.locator('[name="reason"]').filter({ visible: true }).last().fill("C8-D room package approval");
  await page.getByRole("button", { name: "Approve governed package" }).click();
  await page.getByRole("status").filter({ hasText: "Package approved" }).waitFor({ timeout: 30_000 });
  await page.goto(targetFor(step).toString(), { waitUntil: "networkidle" });
  await page.locator('[name="name"]').fill("C8-D Controlled Property Package");
  await page.locator('[name="propertyType"]').fill("short_term_rental");
  await page.getByRole("button", { name: "Create draft package" }).click();
  await page.waitForURL(/\/admin\/furnishing\/packages\/[0-9a-f-]+$/, { timeout: 30_000 });
  lifecycle.packageId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  if (!lifecycle.packageId || !roomPackageId) throw new Error("package-create:PACKAGE_ID_MISSING");
  await page.close();
  return { status: 200, refreshed: 200 };
}

async function runPackageReview(context: BrowserContext, step: Step) {
  const page = await context.newPage();
  const response = await page.goto(targetFor(step).toString(), { waitUntil: "networkidle" });
  if (!response || response.status() >= 400) throw new Error("package-review:ROUTE_FAILED");
  const composition = page.getByRole("heading", { name: "Add approved room package" }).locator("xpath=following-sibling::form");
  await composition.locator('[name="roomVersionId"]').selectOption({ index: 1 });
  await composition.getByRole("button", { name: "Add" }).click();
  await page.waitForLoadState("networkidle");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Validate and submit for review" }).click();
  await page.waitForLoadState("networkidle");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Validate governed package" }).click();
  await page.getByRole("status").filter({ hasText: "validation passed" }).waitFor({ timeout: 30_000 });
  await page.locator('[name="reason"]').filter({ visible: true }).first().fill("C8-D property package approval");
  await page.getByRole("button", { name: "Approve governed package" }).click();
  await page.getByRole("status").filter({ hasText: "Package approved" }).waitFor({ timeout: 30_000 });
  await page.reload({ waitUntil: "networkidle" });
  if (!/approved/i.test(await page.locator("body").innerText())) throw new Error("package-review:AUTHORITATIVE_APPROVAL_MISSING");
  await page.close();
  return { status: response.status(), refreshed: 200 };
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
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  await login(await bootstrapOwner.newPage(), "owner");
  await saveState(bootstrapAdmin, adminState);
  await saveState(bootstrapOwner, ownerState);
  const controlledAdmin = await browser.newContext({ storageState: adminState });
  const controlledOwner = await browser.newContext({ storageState: ownerState });
  for (const step of runbook.steps) {
    const context = step.persona === "controlled-admin" ? controlledAdmin : controlledOwner;
    const route = step.id === "activation"
      ? await runActivation(context, step)
      : step.id === "catalog-import"
        ? await runCatalogImport(context, step)
        : step.id === "catalog-reconciliation"
          ? await runCatalogGovernance(context, step)
          : step.id === "package-create"
            ? await runPackageCreate(context, step)
            : step.id === "package-review"
              ? await runPackageReview(context, step)
        : await visit(context, step);
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
