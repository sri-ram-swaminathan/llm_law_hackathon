import { expect, test } from "@playwright/test";

test("W1 workspace: evidence morphs doc <-> code, tabs, legal drawer", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/r/rel-0.9.0/findings/f-0.9.0-W1");
  await expect(page.getByTestId("finding-title")).toBeVisible();
  await expect(page.getByTestId("ai-label")).toContainText("AI pre-assessment, not legal advice");
  // first evidence is code: highlighted lines
  await expect(page.getByTestId("code-view")).toBeVisible();
  await expect(page.locator("[data-line][data-highlighted]").first()).toBeVisible();
  // confidence triplet expandable
  await page.getByTestId("confidence-applicability").getByRole("button").click();
  await expect(page.getByTestId("confidence-applicability")).toContainText("applies");
  // pick a document evidence item -> markdown with marks
  const docItem = page.locator('[data-testid^="evidence-item-"][data-type="document_span"]').first();
  await docItem.click();
  await expect(page.getByTestId("markdown-view")).toBeVisible();
  await expect(page.locator("mark[data-finding-id]").first()).toBeVisible();
  // legal tab + drawer
  await page.getByTestId("tab-legal").click();
  await expect(page.getByTestId("legal-tab")).toContainText("MiFID II");
  await page.getByRole("button", { name: "Open legal basis drawer" }).click();
  await expect(page.getByTestId("legal-drawer")).toBeVisible();
  await expect(page.getByTestId("legal-drawer").getByTestId("kind-law").first()).toBeVisible();
  await expect(page.getByTestId("legal-drawer").getByTestId("source-link").first()).toBeVisible();
  await expect(page.getByTestId("legal-drawer").getByTestId("ai-interpretation")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("legal-drawer")).toHaveCount(0);
  // third tab renders (slot content or fallback)
  await page.getByTestId("tab-produced").click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  expect(errors).toEqual([]);
});

test("W3 shows a missing-privacy-policy evidence item", async ({ page }) => {
  await page.goto("/r/rel-0.9.0/findings/f-0.9.0-W3");
  await page.locator('[data-testid^="evidence-item-"][data-type="missing"]').first().click();
  await expect(page.getByTestId("missing-state")).toContainText("Privacy policy not provided");
});

test("Evidence room lists bundle, counts and missing rows; opens an artifact", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/r/rel-0.9.0/evidence");
  await expect(page.getByTestId("evidence-list")).toBeVisible();
  await expect(page.getByTestId("missing-privacy_policy")).toContainText("Missing");
  await page.getByTestId("artifact-art-0.9.0-business-plan").click();
  await expect(page).toHaveURL(/evidence\/art-0\.9\.0-business-plan$/);
  await expect(page.getByTestId("markdown-view")).toBeVisible();
  // clicking a highlight opens the finding
  await page.locator("mark[data-finding-id]").first().click();
  await expect(page).toHaveURL(/\/findings\/f-0\.9\.0-/);
  expect(errors).toEqual([]);
});
