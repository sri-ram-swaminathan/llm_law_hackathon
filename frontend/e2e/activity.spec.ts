import { expect, test } from "@playwright/test";

test("activity panel streams the recorded run; persona toggle persists", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await page.getByTestId("persona-counsel").click();
  await expect(page.getByTestId("persona-counsel")).toHaveAttribute("aria-checked", "true");

  await page.getByTestId("run-assessment").click();
  await expect(page.getByTestId("activity-panel")).toBeVisible();
  await page.getByTestId("speed-4").click();
  await expect(page.getByTestId("activity-row-tool_call").first()).toBeVisible({ timeout: 15000 });
  await page.getByTestId("activity-row-tool_call").first().getByRole("button").click();
  await expect(page.getByText("input").first()).toBeVisible();
  await expect(page.getByTestId("activity-row-retry").first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("activity-state")).toHaveText("Completed", { timeout: 60000 });
  await expect(page.getByTestId("ctr-requirements")).toContainText("10/10");
  expect(errors).toEqual([]);
});
