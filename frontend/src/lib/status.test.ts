import { describe, expect, it } from "vitest";
import { CONCLUSIONS, SEVERITIES, chipLabel, effectiveConclusion, isOpen, statusTone, statusWord, type Conclusion, type Severity } from "./status";

// DESIGN §4.5: every (effective_conclusion × severity) pair maps to a plain word + tone.
const WORD: Record<Conclusion, string> = {
  potential_violation: "Violation",
  insufficient_evidence: "Missing evidence",
  uncertain: "Needs counsel",
  satisfied: "Compliant",
  not_applicable: "Not applicable",
};
const SEV: Record<Severity, string> = { blocker: "Blocker", high: "High", medium: "Medium", low: "Low" };
const TONE: Record<Conclusion, (s: Severity) => string> = {
  potential_violation: (s) => (s === "blocker" ? "blocker" : s === "high" ? "high" : "medium"),
  insufficient_evidence: () => "evidence",
  uncertain: () => "uncertain",
  satisfied: () => "satisfied",
  not_applicable: () => "na",
};

describe("status vocabulary", () => {
  it("covers 5 conclusions × 4 severities", () => {
    expect(CONCLUSIONS).toHaveLength(5);
    expect(SEVERITIES).toHaveLength(4);
  });

  for (const c of CONCLUSIONS) {
    for (const s of SEVERITIES) {
      it(`${c} × ${s}`, () => {
        expect(statusWord(c)).toBe(WORD[c]);
        expect(statusTone(c, s)).toBe(TONE[c](s));
        expect(chipLabel(c, s)).toBe(c === "potential_violation" ? `Violation · ${SEV[s]}` : WORD[c]);
        // no raw enum ever leaks into a label
        expect(chipLabel(c, s)).not.toMatch(/_/);
      });
    }
  }

  it("open = not compliant and not n/a", () => {
    expect(CONCLUSIONS.filter((c) => isOpen({ effective_conclusion: c }))).toEqual(["potential_violation", "insufficient_evidence", "uncertain"]);
  });

  it("counsel decisions map to effective conclusions (SPEC §6.3)", () => {
    expect(effectiveConclusion("uncertain", "confirm")).toBe("uncertain");
    expect(effectiveConclusion("uncertain", "override", "satisfied")).toBe("satisfied");
    expect(effectiveConclusion("uncertain", "not_applicable")).toBe("not_applicable");
    expect(effectiveConclusion("satisfied", "need_evidence")).toBe("insufficient_evidence");
  });
});
