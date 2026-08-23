import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  resolve("src/app/(dashboard)/dashboard/actions/[id]/page.tsx"),
  "utf8",
);

describe("PS-001C canonical Action detail route", () => {
  it("decodes canonical colon-delimited Action identifiers before projection lookup", () => {
    expect(page).toContain("actionId: decodeURIComponent(id)");
    expect(page).not.toContain("actionId: id }");
  });
});
