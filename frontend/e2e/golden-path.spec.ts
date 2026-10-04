import { expect, test } from "@playwright/test";

test("v0.9.0 is Not ready with 2 blockers and 1 needs-evidence; W1 opens", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await expect(page).toHaveURL(/\/r\/rel-0\.9\.0\/overview$/);
  await expect(page.getByTestId("gate-headline")).toHaveText("Not ready");
  await expect(page.getByTestId("gate-label")).toContainText("AI pre-assessment, not legal advice");
  await expect(page.getByTestId("count-blockers")).toContainText("2");
  await expect(page.getByTestId("count-evidence")).toContainText("1");

  // release switch animates and updates the gate
  await page.getByTestId("release-1.0.0").click();
  await expect(page.getByTestId("gate-headline")).toHaveText("Ready (AI)");
  await page.getByTestId("release-0.9.0").click();
  await expect(page.getByTestId("gate-headline")).toHaveText("Not ready");

  // findings list + filter
  await page.getByTestId("gate-headline").waitFor();
  await page.getByRole("link", { name: /All findings/ }).click();
  await expect(page.getByTestId("findings-list").locator("li")).toHaveCount(10);
  await page.getByTestId("filter-blocker").click();
  await expect(page.getByTestId("findings-list").locator("li")).toHaveCount(2);

  await page.getByTestId("finding-W1").click();
  await expect(page).toHaveURL(/\/r\/rel-0\.9\.0\/findings\/f-0\.9\.0-W1$/);

  expect(errors).toEqual([]);
});
