import { expect, test } from "@playwright/test";

/** Compliance check (DESIGN §4.6) on fixtures. */
test("W1: company evidence ↔ verdict ↔ law, with connectors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/p/wealthpilot/v/0.9.0/risks/f-0.9.0-W1");
  await expect(page.getByTestId("evidence-document").first()).toContainText("Business plan");
  await expect(page.getByTestId("evidence-document").first().locator("mark")).toBeVisible();
  await expect(page.getByTestId("evidence-code").first()).toContainText("backend/app/config.py");
  await expect(page.getByTestId("evidence-missing")).toContainText("Missing: Regulatory registration");
  const law = page.getByTestId("law-card");
  await expect(law).toHaveCount(3);
  await expect(law.first()).toContainText("LAW · EU");
  await expect(law.first()).toContainText("MiFID II");
  await expect(law.first().getByTestId("source-link")).toHaveText(/Official source/);
  await expect(law.first().locator("blockquote")).toHaveCSS("font-family", /Source Serif 4/);
  // hub and spoke: one connector per evidence card and per provision (5 evidence + 3 law)
  await expect(page.locator("[data-connector]")).toHaveCount(8);
  await expect(page.getByTestId("check-actions")).toBeAttached();
  expect(errors).toEqual([]);
});

test("W2: guidance badge; validator text only under Technical details", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/0.9.0/risks/f-0.9.0-W2");
  await expect(page.getByTestId("law-card").filter({ hasText: "GUIDANCE · ESMA" })).toContainText("not binding");
  await expect(page.getByText(/quote not found/)).toHaveCount(0);
  await page.getByTestId("how-produced").getByRole("button", { name: /How this was produced/ }).click();
  await expect(page.getByText(/quote not found/)).toHaveCount(0);
  await page.getByTestId("technical-toggle").click();
  await expect(page.getByTestId("technical-details")).toContainText("quote not found");
});

test("W3 shows the missing privacy policy with Add document", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/0.9.0/risks/f-0.9.0-W3");
  await expect(page.getByTestId("evidence-missing")).toContainText("Missing: Privacy policy");
  await expect(page.getByTestId("add-document")).toHaveAttribute("href", /\/v\/0\.9\.0\/documents\?f=f-0\.9\.0-W3$/);
});

test("carried label: shown on v1.0.0 W8, not on its origin", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/1.0.0/risks/f-1.0.0-W8");
  await expect(page.getByTestId("carried")).toHaveText(/Carried from v0\.9\.0/);
});

test("unknown finding shows NotFound", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/0.9.0/risks/f-nope");
  await expect(page.getByTestId("not-found")).toContainText("This risk isn't part of v0.9.0");
  await page.goto("/p/wealthpilot/v/1.0.0/risks/f-0.9.0-W1");
  await expect(page.getByTestId("not-found")).toBeVisible();
});

test.describe("mobile 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("columns stack: evidence, verdict, law", async ({ page }) => {
    await page.goto("/p/wealthpilot/v/0.9.0/risks/f-0.9.0-W1");
    const ev = await page.getByTestId("evidence-document").first().boundingBox();
    const verdict = await page.getByTestId("verdict").boundingBox();
    const law = await page.getByTestId("law-card").first().boundingBox();
    expect(ev!.y).toBeLessThan(verdict!.y);
    expect(verdict!.y).toBeLessThan(law!.y);
    await expect(page.getByTestId("connectors")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
