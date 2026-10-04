import { expect, test } from "@playwright/test";

/** T27 shell: IA routes, legacy redirects, breadcrumb, NotFound, mobile nav, theme, mode. Fixtures on :20011. */

test("workspace home shows the org and the product card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("sample-banner")).toContainText("Sample data");
  await expect(page.getByRole("heading", { name: "Wealthpilot SAS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wealthpilot", exact: true })).toBeVisible();
  await expect(page.getByTestId("crumb-org")).toHaveText("Wealthpilot SAS");
});

test("breadcrumb navigates org → product → v0.9.0, and back up", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /open product/i }).click();
  await expect(page).toHaveURL(/\/p\/wealthpilot$/);
  await expect(page.getByTestId("crumb-product")).toHaveText("Wealthpilot");

  await page.getByRole("link", { name: "v0.9.0", exact: true }).first().click();
  await expect(page).toHaveURL(/\/p\/wealthpilot\/v\/0\.9\.0\/summary$/);
  await expect(page.getByTestId("crumb-version")).toHaveText("v0.9.0");
  await expect(page.getByTestId("release-version")).toHaveText("v0.9.0");
  await expect(page.getByTestId("gate-chip").first()).toHaveText("Not ready");

  // version popover keeps the tab
  await page.getByTestId("tab-risks").click();
  await expect(page).toHaveURL(/\/v\/0\.9\.0\/risks$/);
  await page.getByTestId("crumb-version").click();
  await page.getByTestId("version-option-1.0.0").click();
  await expect(page).toHaveURL(/\/p\/wealthpilot\/v\/1\.0\.0\/risks$/);
  await expect(page.getByTestId("release-version")).toHaveText("v1.0.0");

  await page.getByTestId("crumb-product").click();
  await expect(page).toHaveURL(/\/p\/wealthpilot$/);
  await page.getByTestId("crumb-org").click();
  await expect(page).toHaveURL(/\/$/);
});

test("release header: tabs with counts, provenance without fake links", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/1.0.0-rc.12/summary");
  for (const [k, t] of [["summary", "Summary"], ["risks", "Risks"], ["documents", "Documents"], ["code", "Code"], ["fix-plan", "Fix plan"], ["activity", "Activity"]]) {
    await expect(page.getByTestId(`tab-${k}`)).toContainText(t);
  }
  await expect(page.getByTestId("tab-review")).toHaveCount(0); // counsel only
  await expect(page.getByTestId("tab-documents")).toContainText("5");
  // fixtures: the CI run URL is fabricated sample data, so no link may render
  await expect(page.getByTestId("provenance")).toContainText("Recorded audit (CLI)");
  await expect(page.locator('a[href*="11000000"]')).toHaveCount(0);
  await expect(page.getByTestId("rerun")).toHaveAttribute("aria-label", "Re-run assessment on v1.0.0-rc.12");
  await page.goto("/p/wealthpilot/v/0.9.0");
  await expect(page).toHaveURL(/\/v\/0\.9\.0\/summary$/);
});

const LEGACY: [string, RegExp][] = [
  ["/r/rel-0.9.0/findings", /\/p\/wealthpilot\/v\/0\.9\.0\/risks$/],
  ["/r/rel-0.9.0/overview", /\/p\/wealthpilot\/v\/0\.9\.0\/summary$/],
  ["/r/rel-0.9.0", /\/p\/wealthpilot\/v\/0\.9\.0\/summary$/],
  ["/r/rel-0.9.0/findings/f-0.9.0-W1", /\/p\/wealthpilot\/v\/0\.9\.0\/risks\/f-0\.9\.0-W1$/],
  ["/r/rel-0.9.0/evidence", /\/p\/wealthpilot\/v\/0\.9\.0\/documents$/],
  ["/r/rel-0.9.0/fix-plan", /\/p\/wealthpilot\/v\/0\.9\.0\/fix-plan$/],
  ["/profile", /\/p\/wealthpilot\/profile$/],
  ["/releases", /\/p\/wealthpilot$/],
];
for (const [from, to] of LEGACY) {
  test(`legacy ${from} redirects`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(to);
  });
}

test("legacy code evidence goes to the Code tab", async ({ page }) => {
  await page.goto("/r/rel-0.9.0/evidence");
  await expect(page).toHaveURL(/\/documents$/);
  await page.goto("/r/rel-0.9.0/evidence/art-0.9.0-code");
  await expect(page).toHaveURL(/\/v\/0\.9\.0\/code$/);
});

test("unknown version, product and route show NotFound", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/9.9.9/summary");
  await expect(page.getByTestId("not-found")).toContainText("v9.9.9 isn't a release");
  await page.getByRole("link", { name: "Back to Wealthpilot" }).click();
  await expect(page).toHaveURL(/\/p\/wealthpilot$/);
  await page.goto("/p/nope");
  await expect(page.getByTestId("not-found")).toBeVisible();
  await page.goto("/nowhere/at/all");
  await expect(page.getByTestId("not-found")).toBeVisible();
});

test.describe("mobile 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("tabs scroll horizontally and the breadcrumb collapses", async ({ page }) => {
    await page.goto("/p/wealthpilot/v/0.9.0/summary");
    await expect(page.getByTestId("breadcrumb-compact")).toBeVisible();
    await expect(page.getByTestId("crumb-org")).toBeHidden();
    await expect(page.getByTestId("breadcrumb-compact")).toContainText("Wealthpilot");
    await expect(page.getByTestId("crumb-version-compact")).toHaveText("v0.9.0");
    const nav = page.getByTestId("release-tabs");
    const { scrollW, clientW, overflow } = await nav.evaluate((el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth, overflow: getComputedStyle(el).overflowX }));
    expect(overflow).toBe("auto");
    expect(scrollW).toBeGreaterThan(clientW);
    await page.getByTestId("tab-activity").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("tab-activity")).toBeInViewport();
    // the page itself never scrolls sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe("dark theme follows the system", () => {
  test.use({ colorScheme: "dark" });
  test("prefers-color-scheme: dark applies the dark palette; Light overrides it", async ({ page }) => {
    await page.goto("/");
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe("rgb(11, 12, 15)");
    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("theme-light").click();
    expect(await bg()).toBe("rgb(250, 250, 251)");
    await page.reload();
    expect(await bg()).toBe("rgb(250, 250, 251)");
  });
});

test("mode switch: counsel frame, ?mode= mirror and deep link, review route guard", async ({ page }) => {
  await page.goto("/p/wealthpilot/v/0.9.0/review");
  await expect(page).toHaveURL(/\/v\/0\.9\.0\/risks$/); // founder mode never shows the queue
  await page.getByTestId("mode-counsel").click();
  await expect(page).toHaveURL(/mode=counsel/);
  await expect(page.locator("body")).toHaveAttribute("data-mode", "counsel");
  await expect(page.getByTestId("tab-review")).toBeVisible();
  await page.getByTestId("tab-review").click();
  await expect(page.getByTestId("review-page")).toBeVisible();
  await page.getByTestId("mode-founder").click();
  await expect(page).not.toHaveURL(/mode=/);
  await expect(page).toHaveURL(/\/risks$/);

  await page.evaluate(() => localStorage.clear());
  await page.goto("/p/wealthpilot/v/0.9.0/summary?mode=counsel");
  await expect(page.locator("body")).toHaveAttribute("data-mode", "counsel");
  await expect(page.getByTestId("mode-counsel")).toHaveAttribute("aria-checked", "true");
});
