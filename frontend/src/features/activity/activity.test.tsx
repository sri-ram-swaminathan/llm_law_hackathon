import { describe, expect, it } from "vitest";
import events from "@fixtures/events-0.9.0.json";
import type { AgentEvent } from "@/api/client";
import { counters, gapMs, groupRows, MAX_GAP_MS } from "./model";

const all = events as unknown as AgentEvent[];

describe("activity", () => {
  it("groups_and_counters", () => {
    const groups = groupRows(all);
    expect(groups[0].kind).toBe("setup");
    expect(groups[groups.length - 1].kind).toBe("wrapup");
    expect(groups.filter((g) => g.kind === "requirement").length).toBe(10);
    // paired call/result events collapse into a single row
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.filter((r) => r.kind === "tool_result").length).toBe(0);
    expect(rows.filter((r) => r.kind === "tool_call").every((r) => r.done)).toBe(true);
    const c = counters(all);
    expect(c.requirementsTotal).toBe(10);
    expect(c.requirements).toBe(10);
    expect(c.modelCalls).toBe(all.filter((e) => e.type === "model_request").length);
    expect(c.toolCalls).toBe(all.filter((e) => e.type === "tool_call").length);
    expect(c.retries).toBe(all.filter((e) => e.type === "retry").length);
    expect(c.ended).toBe(true);
  });

  it("replay_paces", () => {
    const a = { ts: "2026-10-04T09:00:00Z" }, b = { ts: "2026-10-04T09:00:02Z" };
    expect(gapMs(a, b, 1)).toBe(2000);
    expect(gapMs(a, b, 4)).toBe(500);
    expect(gapMs(a, { ts: "2026-10-04T09:05:00Z" }, 1)).toBe(MAX_GAP_MS);
    expect(gapMs(b, a, 1)).toBe(0);
  });
});
