import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./canonical-report-exports.ts", import.meta.url),
  "utf8",
);

describe("canonical report export actions", () => {
  it("reloads the exact version after creating an export", () => {
    expect(source).toContain(
      "redirect(`/dashboard/reports/${reportId}/versions/${versionId}`)",
    );
  });
});
