import { describe, expect, it } from "vitest";
import b090 from "@fixtures/release-0.9.0.json";
import b100 from "@fixtures/release-1.0.0.json";
import prov from "@fixtures/provisions.json";
import pack from "@fixtures/requirements.json";
import type { FindingView, LegalProvision, ReleaseOut, Requirement } from "@/api/client";
import { blockerBreakdown, checked, fixCounts, shortAct, whatChanged } from "./model";

const provisions = new Map((prov.provisions as unknown as LegalProvision[]).map((p) => [p.id, p]));
const rel = (b: typeof b090) => ({ artifacts: b.artifacts, latest_assessment: b.assessment }) as unknown as ReleaseOut;
const f090 = b090.findings as unknown as FindingView[];
const f100 = b100.findings as unknown as FindingView[];

describe("checked", () => {
  it("counts documents, code files, provisions, acts and duration from fixture data", () => {
    const c = checked(rel(b090), f090, provisions, b090.readiness as never);
    expect(c.documents).toBe(3);
    expect(c.codeFiles).toBe(12);
    expect(c.provisions).toBe(13);
    expect(c.laws).toEqual(["MiFID II", "CMF", "Del. Reg. 2017/565", "GDPR", "AI Act"]);
    expect(c.guidance).toEqual(["ESMA"]);
    expect(c.requirements).toBe(10);
    expect(c.outOfScope).toBe(1);
    expect(c.seconds).toBe(97);
  });
  it("prefers the run's timings when a run summary is given", () => {
    expect(checked(rel(b090), f090, provisions, null, { status: "ok", started_at: "2026-10-04T09:00:00Z", ended_at: "2026-10-04T09:00:46Z" }).seconds).toBe(46);
  });
  it("short act names", () => {
    expect(shortAct({ act_title: "Regulation (EU) 2016/679 (GDPR)", kind: "law" })).toBe("GDPR");
    expect(shortAct({ act_title: "Code monétaire et financier", kind: "law" })).toBe("CMF");
  });
});

describe("what changed", () => {
  it("v0.9.0 → v1.0.0 resolves W1–W7", () => {
    const ch = whatChanged(f090, f100);
    expect(ch.resolved).toEqual(b100.readiness.changes_since_previous.resolved);
    expect(ch.new).toEqual([]);
    expect(ch.unchanged).toEqual(["AI-TRANSPARENCY-01", "FR-NO-EXECUTION-01", "GDPR-PASSWORD-HASH-01"]);
  });
});

describe("blockers and fix plan", () => {
  it("breaks 3 blockers into 2 violations + 1 missing evidence", () => {
    expect(blockerBreakdown(b090.readiness.blockers, f090)).toEqual({ violations: 2, missing: 1, other: 0 });
  });
  it("counts remediation parts of open findings", () => {
    const reqs = new Map((pack.requirements as unknown as Requirement[]).map((r) => [r.id, r]));
    expect(fixCounts(f090, reqs)).toEqual({ code: 6, founder: 4 });
    expect(fixCounts(f100, reqs)).toEqual({ code: 0, founder: 0 });
  });
});
