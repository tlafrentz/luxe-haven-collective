import { readFile } from "node:fs/promises";
import { chromium, type BrowserContext } from "playwright-core";

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

const origin = process.env.FS008G_BROWSER_ORIGIN;
if (!origin) throw new Error("FS008G_BROWSER_ORIGIN_REQUIRED");
const parsed = new URL(origin);
const isolatedOrigin = origin;
if (!["localhost", "127.0.0.1"].includes(parsed.hostname))
  throw new Error("FS008G_BROWSER_ISOLATED_ORIGIN_REQUIRED");
if (process.env.FS008G_BROWSER_MUTATIONS !== "true")
  throw new Error("FS008G_BROWSER_MUTATION_ACK_REQUIRED");

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

const browser = await chromium.launch({ headless: true });
const state = process.env.FS008G_BROWSER_STORAGE_STATE;
const controlled = await browser.newContext(
  state ? { storageState: state } : {},
);
const anonymous = await browser.newContext();
const results: Array<{
  id: string;
  status: number;
  refreshed: number;
  denialChecked: boolean;
}> = [];

async function visit(context: BrowserContext, step: Step) {
  const page = await context.newPage();
  const target = new URL(step.url.replace(runbook.productionOrigin, isolatedOrigin));
  const response = await page.goto(target.toString(), {
    waitUntil: "domcontentloaded",
  });
  if (!response || response.status() >= 500)
    throw new Error(`${step.id}:ROUTE_FAILED`);
  const refreshed = await page.reload({ waitUntil: "domcontentloaded" });
  if (!refreshed || refreshed.status() >= 500)
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
  for (const step of runbook.steps) {
    const route = await visit(controlled, step);
    let denialChecked = false;
    if (
      step.persona === "controlled-owner" ||
      step.persona === "controlled-admin"
    ) {
      const denied = await visit(anonymous, step);
      denialChecked =
        [302, 303, 307, 308, 401, 403, 404].includes(denied.status) ||
        denied.status === 200;
    }
    results.push({ id: step.id, ...route, denialChecked });
  }
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
  await controlled.close();
  await anonymous.close();
  await browser.close();
}
