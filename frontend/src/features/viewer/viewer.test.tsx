import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/tooltip";
import { CodeView } from "./CodeView";
import { MarkdownView } from "./MarkdownView";

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("viewer", () => {
  it("highlights_render: marks wrap exactly the offset range, across inline markup", () => {
    const text = "# Plan\n\nWe offer **personalised buy, sell and hold** recommendations.\n\nNo privacy notice exists.\n";
    const q1 = "personalised buy, sell and hold";
    const s1 = text.indexOf(q1);
    const q2 = "No privacy notice";
    const s2 = text.indexOf(q2);
    const onSelect = vi.fn();
    const { container } = wrap(
      <MarkdownView text={text} onSelectFinding={onSelect}
        highlights={[
          { start: s1, end: s1 + q1.length, findingId: "f1", title: "Personal advice", status: "blocker" },
          { start: s2, end: s2 + q2.length, findingId: "f2", title: "No privacy notice", status: "evidence" },
        ]} />,
    );
    const marks = [...container.querySelectorAll("mark")];
    expect(marks.map((m) => m.textContent)).toEqual([q1, q2]);
    expect(marks[0].closest("strong")).not.toBeNull();
    expect(marks[0].dataset.findingId).toBe("f1");
    fireEvent.click(marks[1]);
    expect(onSelect).toHaveBeenCalledWith("f2");
    expect(screen.getByRole("heading", { name: "Plan" })).toBeTruthy();
  });

  it("code_lines: line numbers and highlighted ranges", () => {
    const content = ["a = 1", "b = 2", "c = 3", "d = 4"].join("\n");
    const { container } = wrap(
      <CodeView path="x.py" content={content} activeFindingId="f1"
        highlights={[{ startLine: 2, endLine: 3, findingId: "f1", title: "T", status: "high" }]} />,
    );
    const rows = [...container.querySelectorAll<HTMLElement>("[data-line]")];
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.dataset.highlighted).map((r) => r.dataset.line)).toEqual(["2", "3"]);
    expect(rows[0].textContent).toContain("1");
  });
});

import { stackNotes } from "./MarginNotes";
describe("stackNotes", () => {
  it("keeps y order and never overlaps", () => {
    const tops = stackNotes([10, 20, 400, 405], [100, 50, 30, 30]);
    expect(tops).toEqual([10, 118, 400, 438]);
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);
  });
});
