import { expect, test } from "@playwright/test";

test("recorded run is never labelled Live; ×4 replay streams events", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/p/wealthpilot/v/0.9.0/activity");
  await expect(page.getByTestId("activity-state")).toContainText("Recorded run");
  await expect(page.getByTestId("ctr-requirements")).toContainText("10/10");
  await expect(page.getByText("Live", { exact: true })).toHaveCount(0);

  await page.getByTestId("speed-4").click();
  await expect(page.getByTestId("activity-state")).toContainText("Replay of recorded run");
  await expect(page.getByTestId("activity-row-tool_call").first()).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});

test("Start demo opens the run; Reset asks for confirmation inline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("demo-provenance")).toContainText("FinTechProto");
  await page.getByTestId("reset-demo").click();
  await expect(page.getByTestId("reset-confirm")).toContainText("replaces all Wealthpilot releases");
  await page.getByTestId("start-demo").click();
  await expect(page).toHaveURL(/\/v\/0\.9\.0\/activity/);
  await expect(page.getByTestId("activity-state")).toContainText("Replay of recorded run");
});
