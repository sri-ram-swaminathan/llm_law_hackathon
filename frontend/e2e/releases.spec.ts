import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { crc32, deflateRawSync } from "node:zlib";

function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

const bundle = JSON.parse(readFileSync(new URL("../../contracts/fixtures/release-1.0.0.json", import.meta.url), "utf8"));
const ciResult = (version: string, pr: number) => ({
  format_version: 1, status: "ok", exit_code: 0,
  release: { ...bundle.release, id: `rel-${version}`, version, source: "ci", pr_number: pr, ci_run_url: "https://github.com/acme/wealthpilot/actions/runs/1", previous_release_id: bundle.release.id },
  assessment: bundle.assessment, findings: [], readiness: { ...bundle.readiness, release_id: `rel-${version}` },
});

/** Builds a one-entry deflate ZIP, like the artifact downloaded by `gh run download`. */
function zipOf(name: string, content: string): Buffer {
  const data = deflateRawSync(Buffer.from(content));
  const nm = Buffer.from(name);
  const crc = crc32(Buffer.from(content));
  const h = (sig: number, ...rest: Buffer[]) => Buffer.concat([Buffer.from(new Uint32Array([sig]).buffer), ...rest]);
  const le16 = (...n: number[]) => Buffer.from(new Uint16Array(n).buffer);
  const le32 = (...n: number[]) => Buffer.from(new Uint32Array(n).buffer);
  const local = h(0x04034b50, le16(20, 0, 8, 0, 0), le32(crc, data.length, Buffer.byteLength(content)), le16(nm.length, 0), nm, data);
  const central = h(0x02014b50, le16(20, 20, 0, 8, 0, 0), le32(crc, data.length, Buffer.byteLength(content)), le16(nm.length, 0, 0, 0, 0), le32(0, 0), nm);
  const eocd = h(0x06054b50, le16(0, 0, 1, 1), le32(central.length, local.length), le16(0));
  return Buffer.concat([local, central, eocd]);
}

test("fix_plan: renders the plan, splits code items and founder appendix, copies the prompt", async ({ page, context }) => {
  const errors = watch(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/r/rel-0.9.0/overview");
  await page.getByRole("link", { name: /Fix plan/ }).click();
  await expect(page).toHaveURL(/\/r\/rel-0\.9\.0\/fix-plan$/);
  await expect(page.getByTestId("fixplan-item")).toHaveCount(6);
  await expect(page.getByText("FR-SUITABILITY-01: Suitability assessment is incomplete")).toBeVisible();
  await expect(page.getByText("Register as a CIF with ORIAS")).toHaveCount(0);

  await page.getByTestId("fixplan-tab-founder").click();
  await expect(page.getByText("Register as a CIF with ORIAS")).toBeVisible();

  await page.getByTestId("copy-prompt").click();
  await expect(page.getByTestId("copy-prompt")).toHaveText(/Copied/);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("Implement the compliance fix plan below");
  expect(clip).toContain("## 1. FR-SUITABILITY-01");
  expect(clip).not.toContain("Appendix: documents and organisational actions");
  await expect(page.getByTestId("download-md")).toHaveAttribute("download", /fix-plan-v0\.9\.0\.md/);
  expect(errors).toEqual([]);
});

test("releases: list with badges, new release upload with progress, import CI run (json + zip)", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/releases");
  await expect(page.getByTestId("release-row-0.9.0")).toBeVisible();
  await expect(page.getByTestId("release-row-0.9.0").getByTestId("source-seed")).toBeVisible();

  // New release
  await page.getByTestId("new-release").click();
  await expect(page.getByTestId("upload-submit")).toBeDisabled();
  await page.getByTestId("file-input").setInputFiles({ name: "code.zip", mimeType: "application/zip", buffer: Buffer.from("PK") });
  await page.getByTestId("version-input").fill("0.9.0");
  await expect(page.getByText("Version 0.9.0 already exists.")).toBeVisible();
  await page.getByTestId("version-input").fill("1.1.0");
  await page.getByTestId("upload-submit").click();
  await expect(page.getByTestId("upload-progress")).toBeVisible();
  await expect(page).toHaveURL(/\/r\/rel-1\.1\.0\/overview$/, { timeout: 10_000 });
  await page.goto("/releases"); // full reload drops fixtures-mode in-memory releases; list is the seeded three again
  await expect(page.getByTestId("release-row-1.0.0")).toBeVisible();

  // Import CI run: result.json
  await page.getByTestId("import-ci").click();
  await page.getByTestId("file-input").setInputFiles({ name: "result.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(ciResult("1.2.0", 42))) });
  await page.getByTestId("import-submit").click();
  await expect(page).toHaveURL(/\/r\/rel-1\.2\.0\/overview$/, { timeout: 10_000 });
  await page.getByRole("link", { name: "Releases" }).click();
  const row = page.getByTestId("release-row-1.2.0");
  await expect(row.getByTestId("source-ci")).toBeVisible();
  await expect(row.getByTestId("pr-link")).toHaveText(/PR #42/);

  // Import CI run: artifact zip
  await page.getByTestId("import-ci").click();
  await page.getByTestId("file-input").setInputFiles({ name: "ccommit-result.zip", mimeType: "application/zip", buffer: zipOf("out/result.json", JSON.stringify(ciResult("1.3.0", 43))) });
  await page.getByTestId("import-submit").click();
  await expect(page).toHaveURL(/\/r\/rel-1\.3\.0\/overview$/, { timeout: 10_000 });

  // invalid file shows an error
  await page.getByRole("link", { name: "Releases" }).click();
  await page.getByTestId("import-ci").click();
  await page.getByTestId("file-input").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await page.getByTestId("import-submit").click();
  await expect(page.getByRole("alert")).toContainText("does not look like a CCOmmit result.json");
  expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
});

test("profile: seeded values, confirm shows confirmed_at", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/profile");
  await expect(page.getByTestId("unconfirmed")).toBeVisible();
  await expect(page.getByTestId("field-jurisdictions")).toContainText("FR");
  await page.getByLabel("Add to Jurisdictions").fill("DE");
  await page.getByLabel("Add to Jurisdictions").press("Enter");
  await expect(page.getByTestId("field-jurisdictions")).toContainText("DE");
  await page.getByRole("button", { name: "Remove DE" }).click();
  await page.getByTestId("confirm-profile").click();
  await expect(page.getByTestId("confirmed-at")).toContainText("Confirmed");
  await expect(page.getByTestId("confirm-profile")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("what changed: resolved and new chips per requirement alias", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/r/rel-1.0.0/overview");
  const panel = page.getByTestId("what-changed");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("changed-resolved")).toBeVisible();
  await expect(panel.getByTestId("changed-new")).toBeVisible();
  await expect(panel.getByTestId("changed-resolved").locator("a").first()).toHaveText(/^[WC]\d+$/);
  await page.getByTestId("release-0.9.0").click();
  await expect(page.getByTestId("what-changed")).toContainText("First assessment");
  expect(errors).toEqual([]);
});
