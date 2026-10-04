import { describe, expect, it } from "vitest";
import r090 from "@fixtures/release-0.9.0.json";
import rrc from "@fixtures/release-1.0.0-rc.json";
import r100 from "@fixtures/release-1.0.0.json";
import reqs from "@fixtures/requirements.json";
import type { FindingView, Requirement } from "@/api/client";
import { computeGate, previewDecision } from "./gatePreview";

const idx = new Map((reqs as unknown as { requirements: Requirement[] }).requirements.map((r) => [r.id, r]));
type B = { findings: FindingView[]; readiness: { gate: string } };

describe("gatePreview", () => {
  it.each([["0.9.0", r090], ["1.0.0-rc", rrc], ["1.0.0", r100]])("reproduces readiness.gate for %s", (_v, b) => {
    const x = b as unknown as B;
    expect(computeGate(x.findings, idx).gate).toBe(x.readiness.gate);
  });

  it("W8 → not applicable on v0.9.0 keeps NOT_READY with W1, W2, W3 blocking", () => {
    const x = r090 as unknown as B;
    const { after } = previewDecision(x.findings, idx, "f-0.9.0-W8", "not_applicable");
    expect(after.gate).toBe("NOT_READY");
    expect(after.blockers).toEqual(["FR-CIF-STATUS-01", "FR-SUITABILITY-01", "GDPR-INFO-01"]);
    expect(after.reviewed).toBe(1);
  });
});
