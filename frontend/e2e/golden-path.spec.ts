import { expect, test } from "@playwright/test";

/** Founder journey (DESIGN §3.1) on fixtures: home → product → v0.9.0 Summary → W1 compliance check. */
test("home → Wealthpilot → v0.9.0 Summary → W1 check", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await expect(page.getByTestId("org-name")).toHaveText("Wealthpilot SAS");
  await expect(page.getByTestId("product-card")).toContainText("Latest releasev1.0.0Ready");
  await page.getByTestId("open-product").click();

  await expect(page).toHaveURL(/\/p\/wealthpilot$/);
  await expect(page.getByTestId("hero-title")).toHaveText("v1.0.0 is ready to launch");
  await expect(page.getByTestId("value-hero").getByTestId("value-line")).toContainText("Checked 6 documents and 12 code files");
  await page.getByRole("link", { name: "v0.9.0", exact: true }).click();

  await expect(page).toHaveURL(/\/v\/0\.9\.0\/summary$/);
  await expect(page.getByTestId("gate-headline")).toHaveText("Not ready");
  await expect(page.getByTestId("block-count")).toHaveText("3 risks block launch");
  await expect(page.getByTestId("block-breakdown")).toContainText("2 violations (blocker)");
  await expect(page.getByTestId("block-breakdown")).toContainText("1 missing mandatory evidence");
  await expect(page.getByTestId("gate-card").getByTestId("ai-label")).toHaveText("AI pre-assessment, not legal advice");
  await expect(page.getByTestId("gate-card").getByTestId("counsel-reviewed")).toHaveText("Counsel-reviewed 0/10");
  await expect(page.getByTestId("summary-page").getByTestId("value-line")).toContainText("Checked 3 documents and 12 code files against 13 provisions");
  await expect(page.locator("[data-category-card]")).toHaveCount(4);
  await expect(page.getByTestId("next-step")).toContainText("6 code changes · 4 founder actions");
  await expect(page.getByTestId("profile-warning")).toBeVisible();

  await page.getByTestId("category-licensing").getByTestId("risk-W1").click();
  await expect(page).toHaveURL(/\/v\/0\.9\.0\/risks\/f-0\.9\.0-W1$/);
  await expect(page.getByTestId("verdict-word")).toHaveText("Violation");
  expect(errors).toEqual([]);
});

test("v1.0.0 reads Ready (not 'Ready (AI)') and shows W1–W7 resolved since v0.9.0", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/1.0.0/summary");
  await expect(page.getByTestId("gate-headline")).toHaveText("Ready");
  await expect(page.getByTestId("block-count")).toHaveText("Nothing blocks launch");
  await expect(page.getByTestId("next-step")).toContainText("Nothing to fix for launch");
  const resolved = page.getByTestId("changed-resolved");
  await page.getByTestId("baseline-picker").selectOption({ label: "v0.9.0" });
  for (const w of ["W1", "W2", "W3", "W4", "W5", "W6", "W7"]) await expect(resolved).toContainText(w);
  await page.getByTestId("baseline-picker").selectOption({ label: "v1.0.0-rc.12" });
  await expect(resolved).not.toContainText("W3");
  await expect(resolved).toContainText("W1");
});

test("Risks: grouped by category with plain-word filters", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/0.9.0/risks");
  await expect(page.getByTestId("risk-list").locator("li")).toHaveCount(10);
  await page.getByTestId("filter-blocking").click();
  await expect(page.getByTestId("risk-list").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("finding-W1")).toContainText("Violation · Blocker");
  await expect(page.getByTestId("finding-W3")).toContainText("Missing: Privacy policy");
});
