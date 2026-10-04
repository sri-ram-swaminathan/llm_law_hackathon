import { describe, expect, it } from "vitest";
import { readZipEntry } from "@/features/releases/zip";
import { buildZip } from "./zipWriter";

describe("zipWriter", () => {
  it("round-trips through the zip reader", async () => {
    const zip = buildZip({ "compliance/privacy-policy.md": "# Privacy policy\nHello é", "backend/app/x.py": "print(1)\n" });
    const dec = new TextDecoder();
    expect(dec.decode((await readZipEntry(zip, (n) => n === "compliance/privacy-policy.md"))!)).toBe("# Privacy policy\nHello é");
    expect(dec.decode((await readZipEntry(zip, (n) => n.endsWith("x.py")))!)).toBe("print(1)\n");
  });
});
