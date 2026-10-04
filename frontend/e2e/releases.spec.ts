import { expect, test } from "@playwright/test";

/** Product home (DESIGN §4.2): semver timeline, honest provenance, Connect CI, profile card, dialogs. */
test("timeline is semver-ordered with honest provenance and no fake CI links", async ({ page }) => {
  await page.goto("/p/wealthpilot");
  const rows = page.getByTestId("timeline").locator("li");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("v1.0.0");
  await expect(rows.nth(1)).toContainText("v1.0.0-rc.12");
  await expect(rows.nth(2)).toContainText("v0.9.0");
  await expect(page.getByTestId("release-row-1.0.0-rc.12")).toContainText("Recorded audit (CLI)");
  await expect(page.locator('a[href*="11000000"]')).toHaveCount(0);
});

test("Connect CI shows the real workflow; profile card warns until confirmed", async ({ page }) => {
  await page.goto("/p/wealthpilot");
  await expect(page.getByTestId("ci-yaml")).toContainText("name: compliance");
  await expect(page.getByTestId("ci-yaml")).toContainText("ccommit-result");
  await expect(page.getByTestId("profile-unconfirmed")).toBeVisible();
});

test("New release and Import CI run dialogs open", async ({ page }) => {
  await page.goto("/p/wealthpilot");
  await page.getByTestId("new-release").click();
  await expect(page.getByTestId("new-release-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("import-ci").click();
  await expect(page.getByTestId("import-dialog")).toBeVisible();
});
