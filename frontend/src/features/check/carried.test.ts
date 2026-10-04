import { describe, expect, it } from "vitest";
import { articleLabel, carriedLabel, clause } from "./model";

describe("carried label", () => {
  it("is hidden on the origin release", () => {
    expect(carriedLabel({ carried_from_version: "0.9.0" }, "0.9.0")).toBeNull();
    expect(carriedLabel({ carried_from_version: null }, "1.0.0")).toBeNull();
  });
  it("shows on later releases", () => {
    expect(carriedLabel({ carried_from_version: "0.9.0" }, "1.0.0")).toBe("Carried from v0.9.0");
  });
});

describe("clause and article", () => {
  it("finds the heading and context around a quote", () => {
    const text = "# Plan\n\n## 1. Summary\n\nWe give a personal adviser in your pocket. More text.";
    const c = clause(text, "personal adviser", null, null);
    expect(c.heading).toBe("1. Summary");
    expect(c.before).toBe("We give a ");
    expect(c.quote).toBe("personal adviser");
    expect(c.after).toBe(" in your pocket. More text.");
  });
  it("formats article references", () => {
    expect(articleLabel({ article: "4", paragraph: "1(4)" })).toBe("Art. 4(1)(4)");
    expect(articleLabel({ article: "L541-1", paragraph: "I" })).toBe("Art. L541-1 (I)");
    expect(articleLabel({ article: "General guideline 2", paragraph: null })).toBe("General guideline 2");
  });
});
