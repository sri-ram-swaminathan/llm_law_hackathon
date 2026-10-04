import { describe, expect, it } from "vitest";
import { groupByCategory, categoryOf } from "./categories";
import { legacyToNew, paths } from "./routes";
import { compareVersions } from "./semver";

describe("paths", () => {
  it("builds the IA of DESIGN §2", () => {
    expect(paths.home()).toBe("/");
    expect(paths.product("wealthpilot")).toBe("/p/wealthpilot");
    expect(paths.profile("wealthpilot")).toBe("/p/wealthpilot/profile");
    expect(paths.summary("wealthpilot", "v0.9.0")).toBe("/p/wealthpilot/v/0.9.0/summary");
    expect(paths.risks("wealthpilot", "0.9.0", "f-1")).toBe("/p/wealthpilot/v/0.9.0/risks/f-1");
    expect(paths.documents("wealthpilot", "0.9.0", "a-1", { f: "f-1" })).toBe("/p/wealthpilot/v/0.9.0/documents/a-1?f=f-1");
    expect(paths.code("wealthpilot", "0.9.0", { path: "app/x.py" })).toBe("/p/wealthpilot/v/0.9.0/code?path=app%2Fx.py");
    expect(paths.fixPlan("wealthpilot", "1.0.0-rc.12")).toBe("/p/wealthpilot/v/1.0.0-rc.12/fix-plan");
    expect(paths.activity("wealthpilot", "0.9.0", { run: "run-1" })).toBe("/p/wealthpilot/v/0.9.0/activity?run=run-1");
    expect(paths.review("wealthpilot", "0.9.0")).toBe("/p/wealthpilot/v/0.9.0/review");
  });
});

describe("legacyToNew", () => {
  const isCode = (id: string) => id === "art-code";
  it.each([
    ["/profile", "/p/wealthpilot/profile"],
    ["/releases", "/p/wealthpilot"],
    ["/r/rel-0.9.0", "/p/wealthpilot/v/0.9.0/summary"],
    ["/r/rel-0.9.0/overview", "/p/wealthpilot/v/0.9.0/summary"],
    ["/r/rel-0.9.0/findings", "/p/wealthpilot/v/0.9.0/risks"],
    ["/r/rel-0.9.0/findings/f-1", "/p/wealthpilot/v/0.9.0/risks/f-1"],
    ["/r/rel-1.0.0-rc.12/evidence", "/p/wealthpilot/v/1.0.0-rc.12/documents"],
    ["/r/rel-0.9.0/evidence/art-doc", "/p/wealthpilot/v/0.9.0/documents/art-doc"],
    ["/r/rel-0.9.0/evidence/art-code", "/p/wealthpilot/v/0.9.0/code"],
    ["/r/rel-0.9.0/fix-plan", "/p/wealthpilot/v/0.9.0/fix-plan"],
  ])("%s → %s", (from, to) => expect(legacyToNew(from, "", isCode)).toBe(to));
  it("keeps the query and ignores new paths", () => {
    expect(legacyToNew("/r/rel-0.9.0/findings", "?filter=blocker")).toBe("/p/wealthpilot/v/0.9.0/risks?filter=blocker");
    expect(legacyToNew("/p/wealthpilot")).toBeNull();
  });
});

describe("semver", () => {
  it("orders prereleases before the release", () => {
    const v = ["1.0.0", "0.9.0", "1.0.0-rc.12", "1.0.0-rc.2", "0.9.1"].sort(compareVersions);
    expect(v).toEqual(["0.9.0", "0.9.1", "1.0.0-rc.2", "1.0.0-rc.12", "1.0.0"]);
  });
});

describe("categories", () => {
  it("maps domains, falls back to other, orders groups", () => {
    expect(categoryOf("data_protection").label).toBe("Data protection");
    expect(categoryOf("weird").key).toBe("other");
    const reqs = new Map([["a", { domain: "ai_transparency" }], ["b", { domain: "licensing" }], ["c", { domain: "licensing" }]]);
    const f = (id: string, c: "satisfied" | "potential_violation", s: "blocker" | "low") => ({ requirement_id: id, effective_conclusion: c, severity: s });
    const g = groupByCategory([f("a", "satisfied", "low"), f("c", "satisfied", "low"), f("b", "potential_violation", "blocker")], reqs);
    expect(g.map((x) => x.category.key)).toEqual(["licensing", "ai_transparency"]);
    expect(g[0].findings[0].requirement_id).toBe("b");
    expect(groupByCategory([], reqs, { keepEmpty: true })).toHaveLength(4);
  });
});
