import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = (path: string) => `src/app/(dashboard)/dashboard/${path}/page.tsx`;

describe("EDS-006 Execute and Learn experience", () => {
  it("exposes the canonical workspace and artifact routes", () => {
    for (const path of [
      "execute",
      "execute/actions",
      "execute/actions/[id]",
      "learn",
      "learn/outcomes",
      "learn/outcomes/[reviewId]",
      "learn/lessons",
      "learn/lessons/[lessonId]",
      "learn/experiments",
      "learn/improvement",
    ]) expect(existsSync(route(path)), path).toBe(true);
  });

  it("makes the lifecycle navigation canonical while retaining legacy route matching", () => {
    const navigation = readFileSync("src/platform/experience/navigation/client-navigation.ts", "utf8");
    expect(navigation).toContain('href: "/dashboard/execute"');
    expect(navigation).toContain('href: "/dashboard/learn"');
    expect(navigation).toContain('"/dashboard/actions/**"');
    expect(navigation).toContain('"/dashboard/learning/**"');
  });

  it("keeps completion and outcome review as separate canonical lifecycle states", () => {
    const projection = readFileSync("src/features/action-center/application/action-center-projection.ts", "utf8");
    expect(projection).toContain('completed: ["link-outcome", "archive"]');
    expect(projection).not.toContain('completed: ["archive"]');
  });
});
