import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("authenticated platform shell", () => {
  it("owns the responsive content gutter without changing the mobile inset", () => {
    const source = readFileSync(new URL("./platform-shell.tsx", import.meta.url), "utf8");

    expect(source).toContain('<main id="main-content" className="sm:mx-6 lg:mx-8">');
    expect(source).not.toContain('<main id="main-content" className="mx-');
  });
});
