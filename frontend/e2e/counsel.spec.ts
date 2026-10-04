import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("counsel deep link: banner, queue, decision with gate impact, Esc exits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/p/wealthpilot/v/0.9.0/summary?mode=counsel");
  await expect(page.getByTestId("counsel-banner")).toBeVisible();
  await expect(page.getByTestId("counsel-progress")).toContainText("Reviewed 0/10");

  await page.getByTestId("open-queue").click();
  await expect(page.getByTestId("review-page")).toBeVisible();
  // Unreviewed first; the uncertain W8 leads.
  await expect(page.getByTestId("review-queue").locator("a").first()).toHaveAttribute("data-testid", "queue-item-W8");

  await page.getByTestId("decision-not_applicable").click();
  await expect(page.getByTestId("gate-impact")).toContainText("W1, W2, W3 still block");
  await page.getByTestId("decision-note").fill("Recommendations are not generated content under Art. 50.");
  await page.getByTestId("decision-note").press("Meta+Enter");
  await expect(page.getByTestId("queue-progress")).toHaveText("1/10");
  await expect(page.getByTestId("counsel-progress")).toContainText("Reviewed 1/10");
  await expect(page.getByTestId("queue-item-W8")).toHaveAttribute("data-reviewed", "true");

  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("counsel-banner")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("document notes carry the decision row in counsel mode only", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/0.9.0/documents?f=W1");
  await expect(page.getByTestId("note-f-0.9.0-W1")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("decision-open")).toHaveCount(0);

  await page.goto("/p/wealthpilot/v/0.9.0/documents?f=W1&mode=counsel");
  const note = page.getByTestId("note-f-0.9.0-W1");
  await note.getByTestId("decision-open").click();
  await expect(note.getByTestId("decision-bar")).toContainText("Applies to W1");
  await note.getByTestId("decision-confirm").click();
  await note.getByTestId("decision-note").fill("Agreed: CIF status is required.");
  await note.getByTestId("decision-record").click();
  await expect(note.getByTestId("decision-recorded")).toContainText("Confirmed");
});
