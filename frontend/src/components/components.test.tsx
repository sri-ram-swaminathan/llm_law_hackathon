import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusChip } from "./status-chip";
import { GateChip, LawBadge, lawBadgeText } from "./tags";
import { ValueLine, valueSentence } from "./provenance";

describe("primitives", () => {
  it("StatusChip v2 renders the plain vocabulary", () => {
    render(<StatusChip conclusion="potential_violation" severity="blocker" />);
    expect(screen.getByText("Violation · Blocker")).toBeTruthy();
  });

  it("GateChip shows gate_label verbatim and the dashed AI-only border", () => {
    const { container } = render(<GateChip gate="READY" label="Ready" aiOnly />);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(container.querySelector("[data-gate=READY]")?.className).toMatch(/border-dashed/);
  });

  it("LawBadge distinguishes law from guidance", () => {
    expect(lawBadgeText({ kind: "law", jurisdiction: "FR", issuer: null, act_title: "Code monétaire et financier" })).toBe("LAW · FR");
    expect(lawBadgeText({ kind: "guidance", jurisdiction: "EU", issuer: null, act_title: "ESMA Guidelines on suitability" })).toBe("GUIDANCE · ESMA");
    render(<LawBadge provision={{ kind: "law", jurisdiction: "EU", issuer: null, act_title: "GDPR" }} />);
    expect(screen.getByText("LAW · EU")).toBeTruthy();
  });

  it("ValueLine says what was checked against what, and how fast", () => {
    const d = { documents: 4, codeFiles: 63, provisions: 14, acts: ["GDPR", "MiFID II", "AI Act", "CMF"], seconds: 46 };
    expect(valueSentence(d)).toBe("Checked 4 documents and 63 code files against 14 provisions from GDPR · MiFID II · AI Act · CMF in 46 s.");
    render(<ValueLine data={d} />);
    expect(screen.getByTestId("value-line").textContent).toBe(valueSentence(d));
  });
});
