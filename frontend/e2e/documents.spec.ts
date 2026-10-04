import { expect, test } from "@playwright/test";

const DOCS = "/p/wealthpilot/v/0.9.0/documents";

test.use({ viewport: { width: 1440, height: 900 } });

test("business plan shows every finding inline with aligned margin notes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(DOCS);
  await expect(page.getByTestId("document-body")).toHaveAttribute("data-artifact-id", "art-0.9.0-business-plan");

  // W1, W2, W3 cite the business plan (4 spans).
  const ids = await page.locator("mark[data-finding-id]").evaluateAll((ms) => [...new Set(ms.map((m) => (m as HTMLElement).dataset.findingId))].sort());
  expect(ids).toEqual(["f-0.9.0-W1", "f-0.9.0-W2", "f-0.9.0-W3"]);
  await expect(page.locator("[data-testid^='note-f-']")).toHaveCount(3);

  // Notes don't overlap and stay in document order.
  const boxes = await page.locator("[data-testid^='note-f-']").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.bottom]));
  const sorted = [...boxes].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) expect(sorted[i][0]).toBeGreaterThanOrEqual(sorted[i - 1][1]);

  // Mark → note.
  await page.locator("mark[data-finding-id='f-0.9.0-W2']").first().click();
  await expect(page.getByTestId("note-f-0.9.0-W2")).toHaveAttribute("data-active", "true");
  // Note → mark.
  await page.getByTestId("note-f-0.9.0-W3").click();
  await expect(page.locator("mark[data-finding-id='f-0.9.0-W3']").first()).toHaveAttribute("data-active", "true");

  // Missing documents with the aliases that cite them.
  await expect(page.getByTestId("missing-privacy_policy")).toContainText("W3");
  await expect(page.getByTestId("missing-terms")).toBeVisible();
  await expect(page.getByTestId("missing-regulatory_registration")).toContainText("W1");

  // Founder mode: no decision controls.
  await expect(page.getByTestId("decision-open")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("?f= focuses the finding's note; product guide opens from the list", async ({ page }) => {
  await page.goto(`${DOCS}?f=W8`);
  await expect(page.getByTestId("document-body")).toHaveAttribute("data-artifact-id", "art-0.9.0-PRODUCT_GUIDE");
  await expect(page.getByTestId("note-f-0.9.0-W8")).toHaveAttribute("data-active", "true");
  await expect(page.locator("mark[data-finding-id='f-0.9.0-W8']").first()).toBeInViewport();
});

test("code tab lists files with findings first, with line bands and notes", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/0.9.0/code");
  await expect(page.getByTestId("files-with-findings")).toContainText("Files with findings (");
  const first = await page.getByTestId("code-file").first().getAttribute("data-path");
  expect(first).toBeTruthy();
  await expect(page.locator("[data-line][data-highlighted='true']").first()).toBeVisible();
  await expect(page.locator("[data-testid^='note-f-']").first()).toBeVisible();
});

test("add document sheet builds a new version", async ({ page }) => {
  await page.goto(DOCS);
  await page.getByTestId("add-privacy_policy").click();
  await expect(page.getByTestId("slot-privacy_policy")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("add-document-version")).toHaveValue("0.9.1");
  await page.getByTestId("add-document-file").setInputFiles({ name: "privacy-policy.md", mimeType: "text/markdown", buffer: Buffer.from("# Privacy policy\n\nWe are the controller.\n") });
  await expect(page.getByTestId("add-document-copy")).toContainText("from v0.9.0's documents and code");
  await page.getByTestId("add-document-submit").click();
  await expect(page).toHaveURL(/\/v\/0\.9\.1\/summary/);
});
