import { readFile } from "node:fs/promises";
import axe, { type AxeResults } from "axe-core";
import { chromium, type Page } from "playwright-core";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};
async function submit(page: Page, name: string) {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name }).click(),
  ]);
  await page.waitForLoadState("networkidle");
}
async function main() {
  const origin = required("FS008G_BROWSER_ORIGIN");
  const project = required("FSUX9_SIMPLE_PROJECT_ID");
  const credentials = JSON.parse(
    await readFile(required("FS008G_BROWSER_CREDENTIAL_FILE"), "utf8"),
  ) as { owner: { email: string; password: string } };
  const browser = await chromium.launch({
    executablePath: required("FS008G_BROWSER_EXECUTABLE_PATH"),
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(
      `window.turnstile={render:function(_n,o){setTimeout(function(){o.callback("XXXX.DUMMY.TOKEN.XXXX")},0);return "local"},remove:function(){},reset:function(){}}`,
    );
    await context.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "" }),
    );
    const page = await context.newPage();
    await page.goto(`${origin}/login`, { waitUntil: "networkidle" });
    const captcha = page.locator('[name="captchaToken"]');
    await captcha.evaluate((node) => {
      (node as HTMLInputElement).value = "XXXX.DUMMY.TOKEN.XXXX";
      window.dispatchEvent(
        new CustomEvent("public-auth-captcha", { detail: true }),
      );
    });
    await page.getByLabel("Email").fill(credentials.owner.email);
    await page.getByLabel("Password").fill(credentials.owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => url.pathname !== "/login");
    const path = `/dashboard/furnishing/projects/${project}`;
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Procurement checklist" })
      .waitFor();
    await submit(page, "Create procurement checklist");
    await page.getByLabel("Status").selectOption("ordered");
    await page
      .getByLabel("Notes")
      .fill("Manually ordered outside the platform");
    await submit(page, "Save");
    await submit(page, "Start installation tracking");
    await page.getByLabel("Received quantity").fill("1");
    await page.getByLabel("Installed quantity").fill("1");
    await page.getByLabel("Delivery status").selectOption("received");
    await page.getByLabel("Installation status").selectOption("installed");
    await submit(page, "Save installation");
    await submit(page, "Complete furnishing project");
    await page.getByText("completed", { exact: true }).first().waitFor();
    const body = await page.locator("body").innerText();
    if (
      !body.includes(
        "No order, payment, retailer request, or provider action occurs",
      )
    )
      throw new Error("NO_EXTERNAL_EFFECT_NOTICE_MISSING");
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload({ waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      if (overflow) throw new Error(`HORIZONTAL_OVERFLOW_${viewport.width}`);
      const results = (await page.evaluate(
        axe.source + "; axe.run(document, {runOnly:['wcag2a','wcag2aa']})",
      )) as AxeResults;
      if (results.violations.length)
        throw new Error(
          `AXE_VIOLATIONS:${JSON.stringify(results.violations.map((item: { id: string }) => item.id))}`,
        );
    }
    console.log(
      JSON.stringify({ result: "FS_UX_009_SIMPLIFIED_BROWSER_PASS", project }),
    );
  } finally {
    await browser.close();
  }
}
void main();
