import { describe, expect, it } from "vitest";
import b090 from "@fixtures/release-0.9.0.json";
import pack from "@fixtures/requirements.json";
import type { FindingView, Requirement } from "@/api/client";
import { groupByCategory } from "@/lib/categories";
import { evidenceSummary, filterCounts } from "./model";

const findings = b090.findings as unknown as FindingView[];
const reqs = new Map((pack.requirements as unknown as Requirement[]).map((r) => [r.id, r]));

describe("risks", () => {
  it("groups by domain in category order", () => {
    const g = groupByCategory(findings, reqs);
    expect(g.map((x) => [x.category.label, x.findings.length])).toEqual([
      ["Licensing", 2], ["Suitability", 3], ["Data protection", 4], ["AI transparency", 1],
    ]);
  });
  it("counts each filter", () => {
    expect(filterCounts(findings, b090.readiness.blockers)).toEqual({ all: 10, blocking: 3, counsel: 1, compliant: 1, na: 1 });
  });
  it("summarises evidence in plain words", () => {
    expect(evidenceSummary(findings[0])).toBe("2 document clauses · 2 code locations · Missing: Regulatory registration");
    expect(evidenceSummary(findings[2])).toBe("2 document clauses · Missing: Privacy policy");
  });
});
