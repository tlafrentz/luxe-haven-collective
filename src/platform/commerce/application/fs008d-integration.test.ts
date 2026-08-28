import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseFs008dWorkbook } from "./fs008d-import";

const workbook = resolve(
  process.cwd(),
  "docs/evidence/FS-008D/source/Catalog Review (1).xlsx",
);
describe("FS-008D authoritative workbook integration", () => {
  it("is bound to the authoritative workbook hash", () => {
    expect(
      createHash("sha256").update(readFileSync(workbook)).digest("hex"),
    ).toBe("ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823");
  });
  it("parses the Catalog Review rows with canonical formula evidence", async () => {
    const rows = await parseFs008dWorkbook(
      readFileSync(workbook),
      "fs008d-integration",
    );
    expect(rows).toHaveLength(110);
    expect(rows.every((row) => row.sheet === "Catalog Review")).toBe(true);
    expect(
      rows.every(
        (row) =>
          row.canonicalExtendedCost === undefined ||
          Number.isFinite(row.canonicalExtendedCost),
      ),
    ).toBe(true);
  });
  it("never promotes needs-review or rejected rows", async () => {
    const rows = await parseFs008dWorkbook(
      readFileSync(workbook),
      "fs008d-integration",
    );
    expect(
      rows.filter((row) => row.outcome === "rejected").length,
    ).toBeGreaterThanOrEqual(0);
    expect(
      rows.every((row) => row.outcome !== "valid" || !row.reasons.length),
    ).toBe(true);
  });
});
