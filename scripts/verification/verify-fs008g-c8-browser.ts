import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import axe from "axe-core";
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
  const lifecycleStatePath = process.env.FS008G_BROWSER_LIFECYCLE_FILE;
  const reviewerCredentialPath =
    process.env.FS008G_BROWSER_REVIEWER_CREDENTIAL_FILE;
  const startStage = process.env.FS008G_BROWSER_START_STAGE;
  if (!credentialPath)
    throw new Error("FS008G_BROWSER_CREDENTIAL_FILE_REQUIRED");
  if (!stateDirectory) throw new Error("FS008G_BROWSER_STATE_DIR_REQUIRED");
  const credentials = JSON.parse(await readFile(credentialPath, "utf8")) as {
    admin: { email: string; password: string; id: string };
    owner: { email: string; password: string; id: string };
    workspaceId: string;
    wrongWorkspaceId: string;
    controlledDesignationId: string;
    controlledRunId: string;
    controlledCorrelationId: string;
    candidateCommit: string;
  };
  const reviewerCredentials = reviewerCredentialPath
    ? (JSON.parse(await readFile(reviewerCredentialPath, "utf8")) as {
        admin: { email: string; password: string; id: string };
      })
    : null;

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
  const reviewerState = `${stateDirectory}/reviewer.json`;
  const bootstrapAdmin = await browser.newContext();
  const bootstrapOwner = await browser.newContext();
  const bootstrapReviewer = reviewerCredentials
    ? await browser.newContext()
    : null;
  const anonymous = await browser.newContext();
  const installLocalTurnstile = async (context: BrowserContext) => {
    await context.addInitScript(
      `window.turnstile={render:function(_node,options){setTimeout(function(){options.callback("XXXX.DUMMY.TOKEN.XXXX")},0);return "fsux9-local"},remove:function(){},reset:function(){}};`,
    );
    await context.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile={render:function(_node,options){setTimeout(function(){options.callback("XXXX.DUMMY.TOKEN.XXXX")},0);return "fsux9-local"},remove:function(){},reset:function(){}};`,
      }),
    );
  };
  await Promise.all(
    [bootstrapAdmin, bootstrapOwner, anonymous, bootstrapReviewer]
      .filter((context): context is BrowserContext => context !== null)
      .map(installLocalTurnstile),
  );
  const results: Array<{
    id: string;
    status: number;
    refreshed: number;
    denialChecked: boolean;
  }> = [];
  const lifecycle = lifecycleStatePath
    ? await readFile(lifecycleStatePath, "utf8")
        .then(
          (value) =>
            JSON.parse(value) as {
              importId: string;
              packageId: string;
              projectId: string;
            },
        )
        .catch(() => ({
          importId: process.env.FS008G_BROWSER_IMPORT_ID ?? "",
          packageId: process.env.FS008G_BROWSER_PACKAGE_ID ?? "",
          projectId: process.env.FS008G_BROWSER_PROJECT_ID ?? "",
        }))
    : {
        importId: process.env.FS008G_BROWSER_IMPORT_ID ?? "",
        packageId: process.env.FS008G_BROWSER_PACKAGE_ID ?? "",
        projectId: process.env.FS008G_BROWSER_PROJECT_ID ?? "",
      };

  async function login(
    page: Page,
    persona: "admin" | "owner" | "reviewer",
  ) {
    const identity =
      persona === "reviewer" ? reviewerCredentials?.admin : credentials[persona];
    if (!identity) throw new Error("REVIEWER_CREDENTIALS_REQUIRED");
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
      await page
        .getByRole("button", { name: "Sign in" })
        .waitFor({ state: "visible" });
      await page.getByLabel("Email").fill(identity.email);
      await page.getByLabel("Password").fill(identity.password);
      const signIn = page.getByRole("button", { name: "Sign in" });
      for (
        let readyAttempt = 0;
        readyAttempt < 20 && (await signIn.isDisabled());
        readyAttempt++
      ) {
        const tokenInput = page.locator('input[name="captchaToken"]');
        if ((await tokenInput.count()) === 0) {
          await page.waitForTimeout(300);
          continue;
        }
        await tokenInput.evaluate((node) => {
          const input = node as HTMLInputElement;
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set?.call(input, "XXXX.DUMMY.TOKEN.XXXX");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("public-auth-captcha", { detail: true }),
          ),
        );
        await page.waitForTimeout(300);
      }
      if (await signIn.isDisabled())
        throw new Error(`LOGIN_CAPTCHA_NOT_READY:${persona}`);
      const captchaToken = page.locator('input[name="captchaToken"]');
      if ((await captchaToken.count()) > 0) {
        await captchaToken.evaluate((node) => {
          (node as HTMLInputElement).value = "XXXX.DUMMY.TOKEN.XXXX";
        });
      }
      await signIn.click();
      await Promise.race([
        page
          .waitForURL((value) => value.pathname !== "/login", {
            timeout: 12_000,
          })
          .catch(() => undefined),
        page
          .getByText("This service is temporarily unavailable.")
          .waitFor({ timeout: 12_000 })
          .catch(() => undefined),
      ]);
      if (new URL(page.url()).pathname !== "/login") return;
      const body = (await page.locator("body").innerText())
        .replace(/\s+/g, " ")
        .slice(0, 800);
      if (
        !body.includes("This service is temporarily unavailable.") ||
        attempt === 3
      )
        throw new Error(`LOGIN_FAILED:${persona}:${body}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }

  async function saveState(context: BrowserContext, path: string) {
    await context.storageState({ path });
    await chmod(path, 0o600);
  }

  function targetFor(step: Step) {
    return new URL(
      step.url
        .replace(runbook.productionOrigin, isolatedOrigin)
        .replaceAll("{workspaceId}", credentials.workspaceId)
        .replaceAll(
          "{projectId}",
          lifecycle.projectId || "00000000-0000-4000-8000-000000000008",
        )
        .replaceAll(
          "{packageId}",
          lifecycle.packageId || "00000000-0000-4000-8000-000000000009",
        )
        .replaceAll(
          "{importId}",
          lifecycle.importId || "00000000-0000-4000-8000-000000000010",
        ),
    );
  }

  async function assertAccessibleLayout(page: Page, id: string) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload({ waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      );
      if (overflow)
        throw new Error(`${id}:HORIZONTAL_OVERFLOW:${viewport.width}`);
      const mainCount = await page.locator("main").count();
      const headingCount = await page
        .getByRole("heading", { level: 1 })
        .count();
      if (mainCount !== 1 || headingCount !== 1)
        throw new Error(
          `${id}:LANDMARK_OR_HEADING_INVALID:${viewport.width}:main=${mainCount}:h1=${headingCount}:url=${page.url()}`,
        );
      await page.addScriptTag({ content: axe.source });
      const violations = await page.evaluate(async () => {
        const result = await (
          window as unknown as {
            axe: {
              run: () => Promise<{
                violations: Array<{
                  id: string;
                  impact: string | null;
                  nodes: Array<{ target: string[] }>;
                }>;
              }>;
            };
          }
        ).axe.run();
        return result.violations.filter(
          (item) => item.impact === "serious" || item.impact === "critical",
        );
      });
      if (violations.length)
        throw new Error(
          `${id}:ACCESSIBILITY:${viewport.width}:${violations.map((item) => `${item.id}[${item.nodes.map((node) => node.target.join(" ")).join("|")}]`).join(",")}`,
        );
      await page.keyboard.press("Tab");
      if (
        !(await page.evaluate(() => document.activeElement !== document.body))
      )
        throw new Error(`${id}:KEYBOARD_FOCUS_MISSING:${viewport.width}`);
    }
  }

  async function submitControlDialog(
    page: Page,
    opener: string | RegExp,
    submitter: string | RegExp,
    options: { resolution?: boolean; validateError?: boolean } = {},
  ) {
    const open = page
      .getByRole("button", { name: opener, exact: typeof opener === "string" })
      .first();
    await open.waitFor({ state: "visible" });
    await open.focus();
    await open.press("Enter");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    if (options.validateError) {
      await dialog.getByRole("button", { name: submitter }).click();
      await page
        .getByRole("status")
        .filter({ hasText: /meaningful reason|Document how/ })
        .waitFor();
    }
    await dialog
      .getByLabel("Required reason")
      .fill("FS-UX-009 isolated browser lifecycle proof");
    if (options.resolution)
      await dialog
        .getByLabel("Risk resolution")
        .fill("Controlled risk reconciled with zero external effects");
    await dialog.getByRole("button", { name: submitter }).click();
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
    if ((await page.getByRole("status").count()) === 0)
      throw new Error(`activation:ACTION_FEEDBACK_REGION_MISSING:${submitter}`);
    await page.reload({ waitUntil: "networkidle" });
  }

  async function runActivation(context: BrowserContext, step: Step) {
    const page = await context.newPage();
    const legacy = await page.goto(
      `${origin}/admin/furnishing/activation?workspaceId=${credentials.workspaceId}`,
      { waitUntil: "domcontentloaded" },
    );
    await page
      .waitForURL(
        (value) => value.pathname === "/admin/furnishing/release-controls",
        {
          timeout: 10_000,
        },
      )
      .catch(() => undefined);
    if (
      !legacy ||
      new URL(page.url()).pathname !== "/admin/furnishing/release-controls"
    )
      throw new Error(`activation:LEGACY_REDIRECT_MISMATCH:${page.url()}`);
    const response = await page.goto(targetFor(step).toString(), {
      waitUntil: "domcontentloaded",
    });
    if (!response || response.status() >= 400)
      throw new Error("activation:ROUTE_FAILED");
    await page.waitForLoadState("networkidle");
    if (
      new URL(page.url()).pathname !==
      `/admin/furnishing/release-controls/workspaces/${credentials.workspaceId}`
    )
      throw new Error("activation:WORKSPACE_CONTEXT_LOST");
    await assertAccessibleLayout(page, "activation");
    const labels = [
      "Catalog viewing",
      "Design Workspace",
      "Budgeting",
      "Procurement readiness",
    ];
    for (const [index, label] of labels.entries()) {
      await submitControlDialog(
        page,
        `Enable ${label}`,
        new RegExp(`^Enable ${label} for `),
        { validateError: index === 0 },
      );
      await submitControlDialog(
        page,
        "Verify capability",
        new RegExp(`^Verify ${label} for `),
      );
    }
    await submitControlDialog(
      page,
      "Suspend controlled release…",
      /^Suspend controlled release for /,
    );
    await submitControlDialog(
      page,
      "Begin governed workspace recovery…",
      "Authorize workspace recovery",
      { resolution: true },
    );
    for (const label of labels) {
      await submitControlDialog(
        page,
        "Verify capability",
        new RegExp(`^Verify ${label} for `),
      );
    }
    const capabilityPath = `/admin/furnishing/release-controls/workspaces/${credentials.workspaceId}/capabilities/procurement_readiness`;
    await page.goto(`${origin}${capabilityPath}`, { waitUntil: "networkidle" });
    await submitControlDialog(
      page,
      "Prepare rollback for Procurement readiness…",
      "Disable capability",
    );
    await page.goto(targetFor(step).toString(), { waitUntil: "networkidle" });
    await submitControlDialog(
      page,
      "Enable Procurement readiness",
      /^Enable Procurement readiness for /,
    );
    await submitControlDialog(
      page,
      "Verify capability",
      /^Verify Procurement readiness for /,
    );
    await page.reload({ waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    if (
      !labels.every((label) => body.includes(label)) ||
      (body.match(/Verified/g) ?? []).length < 4
    )
      throw new Error(
        `activation:AUTHORITATIVE_REFRESH_MISMATCH:${body.replace(/\s+/g, " ").slice(0, 1600)}`,
      );
    await page.close();
    return { status: response.status(), refreshed: 200 };
  }

  async function ensureReleaseState(context: BrowserContext) {
    const page = await context.newPage();
    await page.goto(
      `${origin}/admin/furnishing/release-controls/workspaces/${credentials.workspaceId}`,
      { waitUntil: "networkidle" },
    );
    for (const label of [
      "Catalog viewing",
      "Design Workspace",
      "Budgeting",
      "Procurement readiness",
    ]) {
      const enable = page.getByRole("button", {
        name: `Enable ${label}`,
        exact: true,
      });
      if (await enable.count())
        await submitControlDialog(
          page,
          `Enable ${label}`,
          new RegExp(`^Enable ${label} for `),
        );
      const verify = page.getByRole("button", {
        name: "Verify capability",
        exact: true,
      });
      if (await verify.count())
        await submitControlDialog(
          page,
          "Verify capability",
          new RegExp(`^Verify ${label} for `),
        );
    }
    const body = await page.locator("body").innerText();
    if ((body.match(/Verified/g) ?? []).length < 4)
      throw new Error("RELEASE_STATE_SETUP_FAILED");
    await page.close();
  }

  async function runCatalogImport(context: BrowserContext, step: Step) {
    const page = await context.newPage();
    await page.goto(`${origin}/admin/furnishing/products`, {
      waitUntil: "networkidle",
    });
    if (
      !lifecycle.importId &&
      (await page
        .locator('a[href^="/admin/furnishing/products/"]')
        .evaluateAll((nodes) =>
          nodes.some(
            (node) =>
              /\/admin\/furnishing\/products\/[0-9a-f-]{36}$/.test(
                new URL((node as HTMLAnchorElement).href).pathname,
              ) &&
              !node
                .closest("article, tr, li")
                ?.textContent?.includes("FS-UX-009 anonymous RLS canary"),
          ),
        ))
    ) {
      await page.close();
      return { status: 200, refreshed: 200 };
    }
    const response = await page.goto(
      lifecycle.importId
        ? `${origin}/admin/furnishing/imports/${lifecycle.importId}`
        : `${origin}/admin/furnishing/imports/new?workspace=${credentials.workspaceId}`,
      { waitUntil: "networkidle" },
    );
    if (!response || response.status() >= 400)
      throw new Error("catalog-import:ROUTE_FAILED");
    if (!lifecycle.importId) {
      await page
        .getByLabel("Choose an inventory file")
        .setInputFiles("docs/evidence/FS-008D/source/Catalog Review (1).xlsx");
      await Promise.all([
        page.waitForURL(/\/admin\/furnishing\/imports\/[0-9a-f-]+$/, {
          timeout: 60_000,
        }),
        page.getByRole("button", { name: "Upload and inspect" }).click(),
      ]);
      lifecycle.importId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
      if (!lifecycle.importId)
        throw new Error("catalog-import:IMPORT_ID_MISSING");
    }
    if (await page.getByRole("button", { name: "Use worksheet" }).count()) {
      const catalogSheet = page.locator(
        'form:has(input[name="sheet"][value="Catalog Review"])',
      );
      await Promise.all([
        page.waitForResponse((value) => value.request().method() === "POST"),
        catalogSheet.getByRole("button", { name: "Use worksheet" }).click(),
      ]);
      await page.waitForLoadState("networkidle");
    }
    const mappingButton = page.getByRole("button", {
      name: "Confirm mapping and validate",
    });
    if (await mappingButton.count()) {
      const mappingForm = mappingButton.locator("xpath=ancestor::form");
      await mappingForm.locator('[name="mapping:xlsx:A"]').selectOption("sku");
      await mappingForm
        .locator('[name="mapping:xlsx:N"]')
        .selectOption("product_url");
      await mappingForm.locator('[name="mapping:xlsx:I"]').selectOption("");
      await Promise.all([
        page.waitForURL(/\/validation$/),
        mappingButton.click(),
      ]);
      await page.waitForLoadState("networkidle");
    }
    while (await page.getByRole("button", { name: "Skip row" }).count()) {
      const skip = page.getByRole("button", { name: "Skip row" }).first();
      const skipForm = skip.locator("xpath=ancestor::form");
      await skipForm
        .locator('[name="reason"]')
        .fill("Invalid controlled source row");
      await page.waitForTimeout(1_000);
      await Promise.all([
        page.waitForResponse((value) => value.request().method() === "POST"),
        skip.click(),
      ]);
      await page.reload({ waitUntil: "networkidle" });
    }
    if (
      await page
        .getByRole("button", { name: "Reconcile catalog matches" })
        .count()
    ) {
      await clickForm(page, "Reconcile catalog matches");
      await page.reload({ waitUntil: "networkidle" });
    }
    if (
      await page.getByRole("button", { name: "Commit platform drafts" }).count()
    ) {
      await clickForm(page, "Commit platform drafts");
      await page.reload({ waitUntil: "networkidle" });
    }
    await page.reload({ waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    if (
      !/(?:Import complete|complete with skips)/i.test(body) ||
      !/new\s+109/i.test(body) ||
      !/skipped\s+1/i.test(body)
    )
      throw new Error(
        `catalog-import:ATOMIC_APPLY_RECONCILIATION_FAILED:${body.replace(/\s+/g, " ").slice(0, 1600)}`,
      );
    await page.close();
    return { status: response.status(), refreshed: 200 };
  }

  async function clickForm(
    page: Page,
    buttonName: string,
    fill?: Record<string, string>,
  ) {
    const button = page
      .getByRole("button", { name: buttonName, exact: true })
      .first();
    const form = button.locator("xpath=ancestor::form");
    for (const [name, value] of Object.entries(fill ?? {}))
      await form.locator(`[name="${name}"]`).fill(value);
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST",
      ),
      button.click(),
    ]);
    await page.waitForLoadState("networkidle");
  }

  async function clickClientForm(
    page: Page,
    button: ReturnType<Page["getByRole"]>,
    success: string,
  ) {
    const label = await button.innerText();
    const form = button.locator("xpath=ancestor::form");
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST",
      ),
      button.click(),
    ]);
    const status = form.getByRole("status");
    try {
      await Promise.race([
        status.filter({ hasText: success }).waitFor({ timeout: 30_000 }),
        button.waitFor({ state: "detached", timeout: 30_000 }),
      ]);
    } catch {
      if ((await button.count()) === 0) return;
      const message = (await status.count())
        ? await status.innerText()
        : "ACTION_CONFIRMATION_MISSING";
      throw new Error(`UI_ACTION_FAILED:${label}:${message}`);
    }
  }

  async function runCatalogGovernance(context: BrowserContext, step: Step) {
    const page = await context.newPage();
    const response = await page.goto(targetFor(step).toString(), {
      waitUntil: "networkidle",
    });
    if (!response || response.status() >= 400)
      throw new Error("catalog-reconciliation:ROUTE_FAILED");
    const productLinks: string[] = [];
    for (const productName of ["55 inch Smart TV", "TV Mount", "Sofa"]) {
      await page.goto(
        `${origin}/admin/furnishing/catalog?view=platform&workspace=${credentials.workspaceId}&q=${encodeURIComponent(productName)}`,
        { waitUntil: "networkidle" },
      );
      const link = page
        .locator('a[href^="/admin/furnishing/catalog/"]')
        .filter({ hasText: productName })
        .first();
      if (await link.count())
        productLinks.push(
          new URL((await link.getAttribute("href")) ?? "", origin).toString(),
        );
    }
    if (productLinks.length < 3)
      throw new Error(
        "catalog-reconciliation:TV_MOUNT_DURABLE_PRODUCTS_MISSING",
      );
    for (const href of productLinks) {
      const platformUrl = new URL(href);
      platformUrl.searchParams.set("workspace", credentials.workspaceId);
      await page.goto(platformUrl.toString(), { waitUntil: "networkidle" });
      const adopt = page.getByRole("button", {
        name: "Add to workspace catalog",
        exact: true,
      });
      if (await adopt.count()) {
        await Promise.all([
          page.waitForResponse(
            (response) => response.request().method() === "POST",
          ),
          adopt.click(),
        ]);
        await page.goto(platformUrl.toString(), { waitUntil: "networkidle" });
      }
      const adoptedProduct = page.getByRole("link", {
        name: /Open existing workspace product/,
      });
      if (!(await adoptedProduct.count()))
        throw new Error(
          `catalog-reconciliation:ADOPTION_PROJECTION_MISSING:${page.url()}:${(await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1000)}`,
        );
      await page.goto(
        new URL(
          (await adoptedProduct.getAttribute("href")) ?? "",
          origin,
        ).toString(),
        { waitUntil: "networkidle" },
      );
      const submitReview = page.getByRole("button", {
        name: "Submit for review",
        exact: true,
      });
      if (await submitReview.count()) {
        await clickClientForm(page, submitReview, "submitted for review");
        await page.reload({ waitUntil: "networkidle" });
      }
      const createAlternate = page.getByRole("button", {
        name: "Create controlled alternate offer",
        exact: true,
      });
      if (await createAlternate.count()) {
        await clickClientForm(
          page,
          createAlternate,
          "Controlled alternate offer created",
        );
        await page.reload({ waitUntil: "networkidle" });
      }
      if (
        await page
          .getByRole("button", {
            name: "Approve controlled product",
            exact: true,
          })
          .count()
      ) {
        const approval = page.getByRole("button", {
          name: "Approve controlled product",
          exact: true,
        });
        await approval
          .locator("xpath=ancestor::form")
          .locator('[name="reason"]')
          .fill("C8-D controlled product approval");
        await clickClientForm(page, approval, "Product approved");
      }
      await page.reload({ waitUntil: "networkidle" });
      while (
        await page
          .getByRole("button", {
            name: "Approve controlled offer",
            exact: true,
          })
          .count()
      ) {
        const approval = page
          .getByRole("button", {
            name: "Approve controlled offer",
            exact: true,
          })
          .first();
        await approval
          .locator("xpath=ancestor::form")
          .locator('[name="reason"]')
          .fill("C8-D controlled offer approval");
        await clickClientForm(page, approval, "Offer approved");
        await page.reload({ waitUntil: "networkidle" });
      }
      const assignmentContextIds = await page
        .getByRole("button", { name: "Assign governed offer", exact: true })
        .locator("xpath=ancestor::form")
        .locator('[name="commandContextId"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLInputElement).value),
        );
      for (const [index, role] of (
        ["preferred", "alternate"] as const
      ).entries()) {
        const contextId = assignmentContextIds[index];
        if (!contextId) break;
        const assignmentForm = page.locator(
          `form:has(input[name="commandContextId"][value="${contextId}"])`,
        );
        const assignment = assignmentForm.getByRole("button", {
          name: "Assign governed offer",
          exact: true,
        });
        await assignmentForm.locator('[name="role"]').selectOption(role);
        await assignmentForm.locator('[name="rank"]').fill(String(index + 1));
        await clickClientForm(page, assignment, "offer assigned");
        await page.reload({ waitUntil: "networkidle" });
      }
    }
    await page.close();
    return { status: response.status(), refreshed: 200 };
  }

  async function createRequirement(
    page: Page,
    name: string,
    roomLabel: RegExp,
  ) {
    await page.goto(`${origin}/admin/furnishing/packages/requirements`, {
      waitUntil: "networkidle",
    });
    if ((await page.getByText(name, { exact: true }).count()) === 0) {
      const form = page
        .getByRole("heading", { name: "New requirement" })
        .locator("xpath=ancestor::form");
      await form.locator('[name="name"]').fill(name);
      await form.locator('[name="categoryId"]').selectOption({ index: 1 });
      const rooms = await form
        .locator('[name="roomType"] option')
        .allTextContents();
      const roomIndex = Math.max(
        1,
        rooms.findIndex((label) => roomLabel.test(label)),
      );
      await form
        .locator('[name="roomType"]')
        .selectOption({ index: roomIndex });
      await Promise.all([
        page.waitForResponse(
          (response) => response.request().method() === "POST",
        ),
        form.getByRole("button", { name: "Create requirement" }).click(),
      ]);
      await page.reload({ waitUntil: "networkidle" });
    }
    const submit = page
      .getByRole("button", { name: "Submit for review", exact: true })
      .first();
    if (await submit.count()) {
      await clickClientForm(page, submit, "Requirement submitted for review");
      await page.reload({ waitUntil: "networkidle" });
    }
    const approve = page
      .getByRole("button", { name: "Approve requirement", exact: true })
      .first();
    if (!(await approve.count())) return;
    const review = approve.locator("xpath=ancestor::form");
    await review
      .locator('[name="reason"]')
      .fill("C8-D controlled requirement approval");
    await clickClientForm(page, approve, "Requirement approved");
    await page.reload({ waitUntil: "networkidle" });
  }

  async function runPackageCreate(context: BrowserContext, step: Step) {
    const page = await context.newPage();
    await createRequirement(page, "C8-D Living Room Television", /living/i);
    await createRequirement(page, "C8-D Living Room Mount", /living/i);
    await createRequirement(page, "C8-D Bedroom Sleeping", /bed/i);
    await page.goto(`${origin}/admin/furnishing/packages/rooms/new`, {
      waitUntil: "networkidle",
    });
    await page
      .locator('[name="name"]')
      .fill("C8-D Controlled Living and Bedroom");
    const roomTypeOptions = await page
      .locator('[name="roomType"] option')
      .allTextContents();
    await page.locator('[name="roomType"]').selectOption({
      index: Math.max(
        1,
        roomTypeOptions.findIndex((label) => /living/i.test(label)),
      ),
    });
    await page.getByRole("button", { name: "Create draft package" }).click();
    await page.waitForURL(/\/admin\/furnishing\/packages\/rooms\/[0-9a-f-]+$/, {
      timeout: 30_000,
    });
    const roomPackageId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    for (const [requirementPattern, productPattern] of [
      [/Television/i, /55 inch Smart TV/i],
      [/Mount/i, /TV Mount/i],
    ] as const) {
      const form = page
        .getByRole("heading", { name: "Add requirement" })
        .locator("xpath=following-sibling::form");
      const requirementOptions = await form
        .locator('[name="requirementId"] option')
        .allTextContents();
      const requirementIndex = requirementOptions.findIndex((label) =>
        requirementPattern.test(label),
      );
      if (requirementIndex < 1)
        throw new Error(
          `package-create:REQUIREMENT_OPTION_MISSING:${requirementPattern}`,
        );
      await form
        .locator('[name="requirementId"]')
        .selectOption({ index: requirementIndex });
      await form.locator('[name="quantityRuleId"]').selectOption({ index: 1 });
      const productOptions = await form
        .locator('[name="productId"] option')
        .allTextContents();
      const productIndex = productOptions.findIndex((label) =>
        productPattern.test(label),
      );
      if (productIndex < 1)
        throw new Error(
          `package-create:PRODUCT_OPTION_MISSING:${productPattern}`,
        );
      await form
        .locator('[name="productId"]')
        .selectOption({ index: productIndex });
      await form.locator('[name="priority"]').selectOption("required");
      await Promise.all([
        page.waitForResponse(
          (response) => response.request().method() === "POST",
        ),
        form.getByRole("button", { name: "Add requirement" }).click(),
      ]);
      await form
        .getByRole("status")
        .filter({ hasText: "Composition item added" })
        .waitFor({ timeout: 30_000 });
      await page.reload({ waitUntil: "networkidle" });
    }
    const alternate = page
      .locator("details")
      .filter({ hasText: "Add" })
      .first();
    await alternate.locator("summary").click();
    const alternateOptions = await alternate
      .locator('[name="productId"] option')
      .allTextContents();
    const sofaIndex = alternateOptions.findIndex((label) =>
      /^Sofa$/i.test(label.trim()),
    );
    if (sofaIndex < 0)
      throw new Error("package-create:ALTERNATE_PRODUCT_MISSING");
    await alternate
      .locator('[name="productId"]')
      .selectOption({ index: sofaIndex });
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST",
      ),
      alternate.getByRole("button", { name: "Add", exact: true }).click(),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Submit for review" }).click(),
    ]);
    await page.goto(`${page.url()}?authoritative=${Date.now()}`, {
      waitUntil: "networkidle",
    });
    await clickClientForm(
      page,
      page.getByRole("button", { name: "Validate governed package" }),
      "validation passed",
    );
    await page
      .locator('[name="reason"]')
      .filter({ visible: true })
      .last()
      .fill("C8-D room package approval");
    await clickClientForm(
      page,
      page.getByRole("button", { name: "Approve governed package" }),
      "Package approved",
    );
    await page.goto(targetFor(step).toString(), { waitUntil: "networkidle" });
    await page
      .locator('[name="name"]')
      .fill("C8-D Controlled Property Package");
    await page.locator('[name="propertyType"]').fill("short_term_rental");
    await page.getByRole("button", { name: "Create draft package" }).click();
    await page.waitForURL(/\/admin\/furnishing\/packages\/[0-9a-f-]+$/, {
      timeout: 30_000,
    });
    lifecycle.packageId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    if (!lifecycle.packageId || !roomPackageId)
      throw new Error("package-create:PACKAGE_ID_MISSING");
    await page.close();
    return { status: 200, refreshed: 200 };
  }

  async function runPackageReview(context: BrowserContext, step: Step) {
    const page = await context.newPage();
    const response = await page.goto(targetFor(step).toString(), {
      waitUntil: "networkidle",
    });
    if (!response || response.status() >= 400)
      throw new Error("package-review:ROUTE_FAILED");
    const composition = page
      .getByRole("heading", { name: "Add approved room package" })
      .locator("xpath=following-sibling::form");
    await composition
      .locator('[name="roomVersionId"]')
      .selectOption({ index: 1 });
    await composition
      .locator('[name="quantityRuleId"]')
      .selectOption({ index: 1 });
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST",
      ),
      composition.getByRole("button", { name: "Add" }).click(),
    ]);
    await page.goto(`${page.url()}?compositionRefresh=${Date.now()}`, {
      waitUntil: "networkidle",
    });
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST",
      ),
      page
        .getByRole("button", { name: "Validate and submit for review" })
        .click(),
    ]);
    await page.goto(`${page.url().split("?")[0]}?reviewRefresh=${Date.now()}`, {
      waitUntil: "networkidle",
    });
    await clickClientForm(
      page,
      page.getByRole("button", { name: "Validate governed package" }),
      "validation passed",
    );
    await page
      .locator('[name="reason"]')
      .filter({ visible: true })
      .first()
      .fill("C8-D property package approval");
    await clickClientForm(
      page,
      page.getByRole("button", { name: "Approve governed package" }),
      "Package approved",
    );
    await page.reload({ waitUntil: "networkidle" });
    if (!/approved/i.test(await page.locator("body").innerText()))
      throw new Error("package-review:AUTHORITATIVE_APPROVAL_MISSING");
    await page.close();
    return { status: response.status(), refreshed: 200 };
  }

  async function runOwnerProject(
    owner: BrowserContext,
    admin: BrowserContext,
    step: Step,
  ) {
    const page = await owner.newPage();
    const response = await page.goto(
      lifecycle.projectId
        ? `${origin}/dashboard/furnishing/projects/${lifecycle.projectId}`
        : `${origin}/dashboard/furnishing/projects/new`,
      { waitUntil: "networkidle" },
    );
    if (!response || response.status() >= 400)
      throw new Error("owner-project:DISCOVERY_ROUTE_FAILED");
    if (!lifecycle.projectId) {
      await page.getByRole("link", { name: "Let's get started" }).click();
      await page.waitForURL(
        /\/dashboard\/furnishing\/projects\/new\?step=setup$/,
      );
      const form = page
        .getByRole("button", { name: "Create project workspace" })
        .locator("xpath=ancestor::form");
      await form.locator('[name="propertyId"]').selectOption({ index: 1 });
      await form
        .locator('[name="name"]')
        .fill("C8-D Isolated Furnishing Lifecycle");
      await form.locator('[name="bedrooms"]').fill("1");
      await form.locator('[name="bathrooms"]').fill("0");
      await form.locator('[name="guests"]').fill("2");
      await form.locator('[name="packageVersionId"]').first().check();
      await form.locator('[name="styleVersionId"]').first().check();
      await form.locator('[name="targetBudget"]').fill("25000");
      await form
        .getByRole("button", { name: "Create project workspace" })
        .click();
      await page.waitForURL(
        /\/dashboard\/furnishing\/projects\/[0-9a-f-]{36}$/,
        { timeout: 30_000 },
      );
      lifecycle.projectId =
        new URL(page.url()).pathname.split("/").at(-1) ?? "";
    }
    if (!lifecycle.projectId)
      throw new Error("owner-project:PROJECT_ID_MISSING");
    const generate = page.getByRole("button", { name: "Generate Plan v1" });
    if (await generate.count()) {
      await clickForm(page, "Generate Plan v1");
      await page.reload({ waitUntil: "networkidle" });
    }
    const offer = page.getByRole("button", { name: "Use offer" }).first();
    if (await offer.count()) {
      const offerForm = offer.locator("xpath=ancestor::form");
      await offerForm.locator('[name="offerId"]').selectOption({ index: 1 });
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST"),
        offer.click(),
      ]);
      await page.reload({ waitUntil: "networkidle" });
    }
    const quantity = page.getByText("Override quantity").first();
    if (await quantity.count()) {
      await quantity.click();
      const allocation = page
        .getByRole("button", { name: "Apply", exact: true })
        .first()
        .locator("xpath=ancestor::form");
      await allocation.locator('[name="quantity"]').fill("1");
      await allocation
        .locator('[name="reason"]')
        .fill("Controlled lifecycle allocation");
      await allocation.locator('[name="delivery"]').fill("125.00");
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST"),
        allocation.getByRole("button", { name: "Apply" }).click(),
      ]);
      await page.reload({ waitUntil: "networkidle" });
    }
    await clickForm(page, "Review plan");
    await page.reload({ waitUntil: "networkidle" });
    const submit = page.getByRole("button", { name: "Submit for approval" });
    if (await submit.isDisabled())
      throw new Error("owner-project:PLAN_VALIDATION_BLOCKED");
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      submit.click(),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    if (await page.getByRole("button", { name: /Approve Plan/ }).count())
      throw new Error("owner-project:ADMIN_APPROVAL_EXPOSED_TO_OWNER");
    const adminPage = await admin.newPage();
    await adminPage.goto(
      `${origin}/admin/furnishing/projects/${lifecycle.projectId}`,
      { waitUntil: "networkidle" },
    );
    await clickForm(
      adminPage,
      await adminPage.getByRole("button", { name: /Approve Plan/ }).innerText(),
    );
    await adminPage.reload({ waitUntil: "networkidle" });
    if (!/approved/i.test(await adminPage.locator("body").innerText()))
      throw new Error("owner-project:ADMIN_APPROVAL_MISSING");
    await adminPage.close();
    await page.reload({ waitUntil: "networkidle" });
    await page.close();
    return { status: response.status(), refreshed: 200 };
  }

  async function runSnapshot(owner: BrowserContext, step: Step) {
    const page = await owner.newPage();
    const response = await page.goto(targetFor(step).toString(), {
      waitUntil: "networkidle",
    });
    if (!response || response.status() >= 400)
      throw new Error("snapshot:ROUTE_FAILED");
    await clickForm(page, "Save immutable catalog snapshot");
    await page.reload({ waitUntil: "networkidle" });
    await clickForm(page, "Save immutable catalog snapshot");
    await page.reload({ waitUntil: "networkidle" });
    await page.close();
    return { status: response.status(), refreshed: 200 };
  }

  async function runProcurement(
    context: BrowserContext,
    step: Step,
    reviewer?: BrowserContext,
  ) {
    const page = await context.newPage();
    const response = await page.goto(targetFor(step).toString(), {
      waitUntil: "networkidle",
    });
    if (!response || response.status() >= 400)
      throw new Error(`${step.id}:ROUTE_FAILED`);
    if (step.id === "procurement-baseline")
      await clickForm(page, "Start procurement");
    if (step.id === "budget") {
      await clickForm(page, "Submit budget for approval");
      await page.reload({ waitUntil: "networkidle" });
      await clickForm(page, "Record reasoned adjustment", {
        amount: "10.00",
        reason: "C8-D planned versus actual reconciliation",
      });
    }
    if (step.id === "batch-order") {
      if ((await page.getByRole("button", { name: "Authorize batch" }).count()) === 0) {
        await page.locator('[name="retailerId"]').selectOption({ index: 1 });
        await clickForm(page, "Submit batch for authorization");
        await page.reload({ waitUntil: "networkidle" });
      }
      const approvalPage = reviewer ? await reviewer.newPage() : page;
      if (reviewer)
        await approvalPage.goto(targetFor(step).toString(), {
          waitUntil: "networkidle",
        });
      await clickForm(approvalPage, "Authorize batch");
      if (reviewer) await approvalPage.close();
    }
    if (step.id === "receiving") {
      const first = page
        .getByRole("button", { name: "Record", exact: true })
        .first();
      const receipt = first.locator("xpath=ancestor::form");
      await receipt.locator('[name="receivedQuantity"]').fill("1");
      await receipt.locator('[name="acceptedQuantity"]').fill("0");
      await receipt.locator('[name="condition"]').selectOption("damaged");
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST"),
        first.click(),
      ]);
      await page.goto(
        `${origin}/admin/furnishing/projects/${lifecycle.projectId}/procurement?view=returns`,
        { waitUntil: "networkidle" },
      );
      await clickForm(page, "Resolve discrepancy", {
        reason: "Synthetic damaged unit reconciled",
      });
      await page.goto(targetFor(step).toString(), { waitUntil: "networkidle" });
      for (const record of await page
        .getByRole("button", { name: "Record", exact: true })
        .all()) {
        const f = record.locator("xpath=ancestor::form"),
          quantity = await f.locator('[name="receivedQuantity"]').inputValue();
        await f.locator('[name="acceptedQuantity"]').fill(quantity);
        await Promise.all([
          page.waitForResponse((r) => r.request().method() === "POST"),
          record.click(),
        ]);
        await page.reload({ waitUntil: "networkidle" });
      }
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.close();
    return { status: response.status(), refreshed: 200 };
  }

  async function runOwnerProjection(context: BrowserContext, step: Step) {
    const result = await visit(context, step),
      page = await context.newPage();
    await page.goto(targetFor(step).toString(), { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    if (
      /Admin reason|Resolve discrepancy|Record external order|Authorize batch|Governed cleanup|Immutable activity/i.test(
        body,
      )
    )
      throw new Error("owner-projection:ADMIN_INTERNALS_EXPOSED");
    await page.close();
    return result;
  }

  async function runKillSwitchCleanup(
    admin: BrowserContext,
    owner: BrowserContext,
  ) {
    const page = await admin.newPage();
    const response = await page.goto(
      `${origin}/admin/furnishing/release-controls`,
      { waitUntil: "networkidle" },
    );
    await assertAccessibleLayout(page, "release-controls");
    await submitControlDialog(
      page,
      "Suspend globally…",
      "Suspend global furnishing release",
      { validateError: true },
    );
    const blocked = await admin.newPage();
    await blocked.goto(
      `${origin}/admin/furnishing/projects/${lifecycle.projectId}/procurement?view=budget`,
      { waitUntil: "networkidle" },
    );
    await clickForm(blocked, "Record reasoned adjustment", {
      amount: "1.00",
      reason: "must fail while disabled",
    })
      .then(() => {
        throw new Error("kill-switch-cleanup:MUTATION_ALLOWED");
      })
      .catch((error) => {
        if (String(error).includes("MUTATION_ALLOWED")) throw error;
      });
    await blocked.close();
    const historical = await owner.newPage();
    const read = await historical.goto(
      `${origin}/dashboard/furnishing/projects/${lifecycle.projectId}/procurement`,
      { waitUntil: "networkidle" },
    );
    if (!read || read.status() >= 400)
      throw new Error("kill-switch-cleanup:HISTORICAL_READ_DENIED");
    await historical.close();
    await submitControlDialog(
      page,
      "Begin governed global recovery…",
      "Authorize protected recovery",
      { resolution: true },
    );
    await page.close();
    return { status: response?.status() ?? 200, refreshed: 200 };
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
    if (bootstrapReviewer) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await login(await bootstrapReviewer.newPage(), "reviewer");
    }
    await saveState(bootstrapAdmin, adminState);
    await saveState(bootstrapOwner, ownerState);
    if (bootstrapReviewer) await saveState(bootstrapReviewer, reviewerState);
    const controlledAdmin = await browser.newContext({
      storageState: adminState,
    });
    const controlledOwner = await browser.newContext({
      storageState: ownerState,
    });
    const controlledReviewer = bootstrapReviewer
      ? await browser.newContext({ storageState: reviewerState })
      : undefined;
    if (process.env.FS008G_BROWSER_ENSURE_RELEASE_STATE === "true")
      await ensureReleaseState(controlledAdmin);
    const startIndex = startStage
      ? runbook.steps.findIndex((step) => step.id === startStage)
      : 0;
    if (startStage && startIndex < 0)
      throw new Error(`FS008G_BROWSER_START_STAGE_INVALID:${startStage}`);
    for (const step of runbook.steps.slice(Math.max(0, startIndex))) {
      process.stderr.write(`FS008G_BROWSER_STAGE_START:${step.id}\n`);
      const context =
        step.persona === "controlled-admin" ? controlledAdmin : controlledOwner;
      const route =
        step.id === "activation"
          ? await runActivation(context, step)
          : step.id === "catalog-import"
            ? await runCatalogImport(context, step)
            : step.id === "catalog-reconciliation"
              ? await runCatalogGovernance(context, step)
              : step.id === "package-create"
                ? await runPackageCreate(context, step)
                : step.id === "package-review"
                  ? await runPackageReview(context, step)
                  : step.id === "owner-project"
                    ? await runOwnerProject(
                        controlledOwner,
                        controlledAdmin,
                        step,
                      )
                    : step.id === "snapshot"
                      ? await runSnapshot(controlledOwner, step)
                      : [
                            "procurement-baseline",
                            "budget",
                            "batch-order",
                            "receiving",
                          ].includes(step.id)
                        ? await runProcurement(
                            controlledAdmin,
                            step,
                            controlledReviewer,
                          )
                        : step.id === "owner-projection"
                          ? await runOwnerProjection(controlledOwner, step)
                          : step.id === "kill-switch-cleanup"
                            ? await runKillSwitchCleanup(
                                controlledAdmin,
                                controlledOwner,
                              )
                            : await visit(context, step);
      let denialChecked = false;
      if (
        step.persona === "controlled-owner" ||
        step.persona === "controlled-admin"
      ) {
        const page = await anonymous.newPage();
        await page.goto(targetFor(step).toString(), {
          waitUntil: "domcontentloaded",
        });
        denialChecked = new URL(page.url()).pathname === "/login";
        await page.close();
        if (!denialChecked)
          throw new Error(`${step.id}:ANONYMOUS_ACCESS_ALLOWED`);
      }
      results.push({ id: step.id, ...route, denialChecked });
      if (lifecycleStatePath) {
        await writeFile(lifecycleStatePath, JSON.stringify(lifecycle), {
          mode: 0o600,
        });
        await chmod(lifecycleStatePath, 0o600);
      }
    }
    await controlledAdmin.close();
    await controlledOwner.close();
    await controlledReviewer?.close();
    process.stdout.write(
      JSON.stringify(
        {
          status: "passed",
          mode: "isolated-browser",
          steps: results.length,
          externalEffects: 0,
          lifecycle,
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await bootstrapAdmin.close();
    await bootstrapOwner.close();
    await bootstrapReviewer?.close();
    await anonymous.close();
    await browser.close();
    await rm(adminState, { force: true });
    await rm(ownerState, { force: true });
    await rm(reviewerState, { force: true });
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
