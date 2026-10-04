import { describe, expect, it } from "vitest";
import { provenance } from "./provenance";

const base = { pr_number: null, branch: null, git_sha: null, ci_run_url: null } as const;
const CI_URL = "https://github.com/RomanGrebnev/FinTechProto/actions/runs/123";

describe("provenance()", () => {
  it("CI with a run URL links the run", () => {
    const p = provenance({ ...base, source: "ci", ci_run_url: CI_URL, pr_number: 1, branch: "dev", git_sha: "8d02b11aaaaaaaa" });
    expect(p.text).toBe("CI · PR #1 · run ↗ · ref dev @ 8d02b11");
    expect(p.parts.find((x) => x.key === "ci-run")?.href).toBe(CI_URL);
    // the sha is never a link
    expect(p.parts.find((x) => x.key === "ref")?.href).toBeUndefined();
  });

  it("CI without a URL is a recorded CLI audit, no links", () => {
    const p = provenance({ ...base, source: "ci", branch: "demo/v1", git_sha: "3c1e9a2bbbbbbbb" });
    expect(p.sourceLabel).toBe("Recorded audit (CLI)");
    expect(p.text).toBe("Recorded audit (CLI) · ref demo/v1 @ 3c1e9a2");
    expect(p.parts.some((x) => x.href)).toBe(false);
  });

  it("fixtures mode suppresses every link", () => {
    const p = provenance({ ...base, source: "ci", ci_run_url: CI_URL, pr_number: 1 }, null, { fixtures: true });
    expect(p.parts.some((x) => x.href)).toBe(false);
    expect(p.sourceLabel).toBe("Recorded audit (CLI)");
  });

  it("ignores non-https links", () => {
    expect(provenance({ ...base, source: "ci", ci_run_url: "javascript:alert(1)" }).parts.some((x) => x.href)).toBe(false);
  });

  it("upload, derived upload and seed", () => {
    expect(provenance({ ...base, source: "ui", branch: "v0.9.0", git_sha: "7bf6004ccccc" }).text).toBe("Upload · ref v0.9.0 @ 7bf6004");
    expect(provenance({ ...base, source: "ui" }, null, { derivedFrom: "0.9.0" }).text).toBe("Upload · derived from v0.9.0");
    expect(provenance({ ...base, source: "seed" }).text).toBe("Recorded run");
  });

  it("run state: live only while running", () => {
    const r = { ...base, source: "ui" as const };
    expect(provenance(r, { status: "running", started_at: "2026-10-04T09:00:00Z", ended_at: null }).parts.at(-1)).toMatchObject({ text: "Live run", live: true });
    const done = provenance(r, { status: "ok", started_at: "2026-10-04T09:00:00Z", ended_at: "2026-10-04T09:01:00Z" });
    expect(done.parts.at(-1)?.text).toMatch(/^assessed \d{1,2} Oct \d{2}:\d{2}$/);
    expect(done.text).not.toMatch(/Live/);
  });
});
