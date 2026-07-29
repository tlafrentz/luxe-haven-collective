import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/features/integrations/hospitable/lib/sync-messages.ts",
  "utf8",
);

describe("GC-003 manual hydration semantics", () => {
  it("rescans provider history for operator-requested and recovery syncs", () => {
    expect(source).toContain(
      'const forceHydration=options.mode==="manual"||options.mode==="recovery"',
    );
    expect(source).toContain("force:forceHydration");
  });

  it("does not force automatic or incremental hydration", () => {
    expect(source).not.toContain(
      'forceHydration=options.mode==="automatic"',
    );
    expect(source).not.toContain(
      'forceHydration=options.mode==="incremental"',
    );
  });
});
