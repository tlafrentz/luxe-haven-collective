import { readFile } from "node:fs/promises";
import axe from "axe-core";
import { chromium, type Page } from "playwright-core";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};

async function submit(page: Page, buttonName: string) {
  const button = page.getByRole("button", { name: buttonName }).first();
  const response = await Promise.all([
    page.waitForResponse(
      (candidate) => candidate.request().method() === "POST",
    ),
    button.click(),
  ]).then(([candidate]) => candidate);
  if (response.status() >= 500)
    throw new Error(`${buttonName}:SERVER_ACTION_FAILED:${response.status()}`);
}

async function main() {
  const origin = required("FS008G_BROWSER_ORIGIN");
  const resumeAtInspection = process.env.FSUX9_RESUME_AT_INSPECTION === "1";
  const skipCorrection = process.env.FSUX9_SKIP_CORRECTION === "1";
  if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
    throw new Error("FSUX9_LOCAL_BROWSER_REQUIRED");
  const credentials = JSON.parse(
    await readFile(required("FS008G_BROWSER_CREDENTIAL_FILE"), "utf8"),
  ) as { admin: { email: string; password: string } };
  const browser = await chromium.launch({
    executablePath: required("FS008G_BROWSER_EXECUTABLE_PATH"),
    headless: true,
  });
  const context = await browser.newContext();
  await context.addInitScript(
    `window.turnstile={render:function(_node,options){setTimeout(function(){options.callback("XXXX.DUMMY.TOKEN.XXXX")},0);return "fsux9-local"},remove:function(){},reset:function(){}};`,
  );
  await context.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.turnstile={render:function(_node,options){setTimeout(function(){options.callback("XXXX.DUMMY.TOKEN.XXXX")},0);return "fsux9-local"},remove:function(){},reset:function(){}};`,
    }),
  );
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/login`, { waitUntil: "networkidle" });
    const captcha = page.locator('[name="captchaToken"]');
    await captcha
      .waitFor({ state: "attached", timeout: 5_000 })
      .catch(async () => {
        throw new Error(
          `LOGIN_FORM_MISSING:${page.url()}:${(await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500)}`,
        );
      });
    await captcha.evaluate((node) => {
      (node as HTMLInputElement).value = "XXXX.DUMMY.TOKEN.XXXX";
      window.dispatchEvent(
        new CustomEvent("public-auth-captcha", { detail: true }),
      );
    });
    await page.getByLabel("Email").fill(credentials.admin.email);
    await page.getByLabel("Password").fill(credentials.admin.password);
    const signIn = page.getByRole("button", { name: "Sign in" });
    await signIn.waitFor({ state: "visible" });
    for (
      let attempt = 0;
      attempt < 20 && (await signIn.isDisabled());
      attempt++
    )
      await page.waitForTimeout(250);
    if (await signIn.isDisabled()) throw new Error("LOGIN_CAPTCHA_NOT_READY");
    await signIn.click();
    await page
      .waitForURL((url) => url.pathname !== "/login", { timeout: 10_000 })
      .catch(async () => {
        throw new Error(
          `LOGIN_FAILED:${(await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 700)}`,
        );
      });

    let installationId = process.env.FSUX9_INSTALLATION_ID?.trim();
    await page.goto(`${origin}/admin/furnishing/installations/new`, {
      waitUntil: "networkidle",
    });
    const noEffect = await page.locator("body").innerText();
    if (!/No order or external service action is created here/i.test(noEffect))
      throw new Error(
        `INSTALLATION_NO_EFFECT_NOTICE_MISSING:${page.url()}:${noEffect.replace(/\s+/g, " ").slice(0, 500)}`,
      );
    if (!installationId) {
      if (await page.getByRole("button", { name: "Create project" }).count())
        await submit(page, "Create project");
      else
        await page.getByRole("link", { name: "Open existing" }).first().click();
      await page.waitForURL(/\/admin\/furnishing\/installations\/[0-9a-f-]+$/);
      installationId = new URL(page.url()).pathname.split("/").at(-1);
    }
    if (!installationId) throw new Error("INSTALLATION_ID_MISSING");

    if (!resumeAtInspection) {
      await page.goto(
        `${origin}/admin/furnishing/installations/${installationId}/orders`,
        {
          waitUntil: "networkidle",
        },
      );
      if (!(await page.getByText("Controlled test evidence only").count())) {
        await page
          .getByPlaceholder("External order reference")
          .fill("FSUX9-CONTROLLED-EVIDENCE-NO-ORDER");
        await page
          .getByPlaceholder("Ordering party")
          .fill("Controlled test evidence only");
        await page
          .locator('[name="orderDate"]')
          .fill(new Date().toISOString().slice(0, 10));
        await page.locator('[name="quantity"]').fill("1");
        await page
          .locator('[name="evidenceClass"]')
          .selectOption("controlled_test");
        await page
          .getByPlaceholder("Private evidence reference")
          .fill("fsux9-local-no-provider-effect");
        await submit(page, "Record evidence");
      }

      await page.goto(
        `${origin}/admin/furnishing/installations/${installationId}/deliveries`,
        {
          waitUntil: "networkidle",
        },
      );
      if (!(await page.getByText("physically_received").count())) {
        await page.goto(
          `${origin}/admin/furnishing/installations/${installationId}`,
          { waitUntil: "networkidle" },
        );
        const receipt = page
          .getByRole("button", { name: "Record physical receipt" })
          .locator("xpath=ancestor::form");
        await receipt.locator('[name="quantity"]').fill("1");
        await receipt.locator('[name="evidenceClass"]').evaluate((node) => {
          (node as HTMLInputElement).value = "controlled_test";
        });
        await submit(page, "Record physical receipt");
      }
      await page.goto(
        `${origin}/admin/furnishing/installations/${installationId}/rooms`,
        { waitUntil: "networkidle" },
      );
      if (!(await page.getByText("FS-UX-009 controlled installer").count())) {
        await page.goto(
          `${origin}/admin/furnishing/installations/${installationId}`,
          { waitUntil: "networkidle" },
        );
        const installation = page
          .getByRole("button", { name: "Record installation evidence" })
          .locator("xpath=ancestor::form");
        await installation.locator('[name="quantity"]').fill("1");
        await installation
          .locator('[name="externalActor"]')
          .fill("FS-UX-009 controlled installer");
        await installation
          .locator('[name="evidenceClass"]')
          .evaluate((node) => {
            (node as HTMLInputElement).value = "controlled_test";
          });
        await submit(page, "Record installation evidence");
      }
    }

    await page.goto(
      `${origin}/admin/furnishing/installations/${installationId}/completion`,
      {
        waitUntil: "networkidle",
      },
    );
    if (!(await page.getByText(/Immutable completion snapshot/).count())) {
      await page.goto(
        `${origin}/admin/furnishing/installations/${installationId}/inspection`,
        {
          waitUntil: "networkidle",
        },
      );
      const lineInspection = page
        .getByRole("button", { name: "Record line inspection" })
        .first()
        .locator("xpath=ancestor::form");
      await lineInspection
        .locator('[name="externalInspector"]')
        .fill("FS-UX-009 controlled inspector");
      await submit(page, "Record line inspection");
      await page.reload({ waitUntil: "networkidle" });
      const propertyInspection = page
        .getByRole("button", { name: "Record property inspection" })
        .locator("xpath=ancestor::form");
      await propertyInspection
        .locator('[name="externalInspector"]')
        .fill("FS-UX-009 controlled inspector");
      await submit(page, "Record property inspection");
      await page.goto(
        `${origin}/admin/furnishing/installations/${installationId}/completion`,
        {
          waitUntil: "networkidle",
        },
      );
    }
    if (
      await page
        .getByRole("button", { name: "Approve installation completion" })
        .count()
    ) {
      await submit(page, "Approve installation completion");
      await page.reload({ waitUntil: "networkidle" });
    }
    if (!(await page.getByText(/Immutable completion snapshot/).count()))
      throw new Error("INSTALLATION_COMPLETION_SNAPSHOT_MISSING");
    const correction = page
      .getByRole("button", { name: "Record material correction" })
      .locator("xpath=ancestor::form");
    if (!skipCorrection && (await correction.count())) {
      await correction
        .locator('[name="externalActor"]')
        .fill("FS-UX-009 corrected controlled installer");
      await submit(page, "Record material correction");
      await page.goto(
        `${origin}/admin/furnishing/installations/${installationId}/inspection`,
        { waitUntil: "networkidle" },
      );
      const correctedLine = page
        .getByRole("button", { name: "Record line inspection" })
        .first()
        .locator("xpath=ancestor::form");
      await correctedLine
        .locator('[name="externalInspector"]')
        .fill("FS-UX-009 correction inspector");
      await submit(page, "Record line inspection");
      await page.reload({ waitUntil: "networkidle" });
      const correctedProperty = page
        .getByRole("button", { name: "Record property inspection" })
        .locator("xpath=ancestor::form");
      await correctedProperty
        .locator('[name="externalInspector"]')
        .fill("FS-UX-009 correction inspector");
      await submit(page, "Record property inspection");
      await page.goto(
        `${origin}/admin/furnishing/installations/${installationId}/completion`,
        { waitUntil: "networkidle" },
      );
      await submit(page, "Approve installation completion");
      await page.reload({ waitUntil: "networkidle" });
      if ((await page.getByText(/Immutable completion snapshot/).count()) < 1)
        throw new Error("INSTALLATION_REAPPROVAL_SNAPSHOT_MISSING");
    }

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
        throw new Error(`INSTALLATION_LAYOUT_OVERFLOW:${viewport.width}`);
      const result = await page
        .evaluate(axe.source)
        .then(() =>
          page.evaluate(async () =>
            (window as typeof window & { axe: typeof axe }).axe.run(),
          ),
        );
      const serious = result.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      if (serious.length)
        throw new Error(
          `INSTALLATION_AXE:${serious.map((x) => x.id).join(",")}`,
        );
    }
    process.stdout.write(
      JSON.stringify({ status: "passed", installationId, externalEffects: 0 }),
    );
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
