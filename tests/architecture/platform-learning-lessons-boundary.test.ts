import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Platform Learning knowledge boundary", () => {
  it("interprets completed review references without feature dependencies", () => {
    const source = readFileSync("src/platform/learning/domain/lesson-knowledge.ts", "utf8");
    expect(source).not.toMatch(/@\/features|supabase|stripe/i);
    expect(source).toContain("sourceReviewIds");
    expect(source).toContain("LessonContradicted");
  });

  it("persists immutable knowledge, applicability, relationships, and governance history", () => {
    const sql = readFileSync(
      "supabase/migrations/20260726090000_learning_assumptions_lessons.sql", "utf8",
    );
    for (const table of [
      "learning_assumptions", "learning_validated_assumption_results",
      "learning_candidate_lessons", "learning_lesson_versions",
      "learning_lesson_applicability", "learning_lesson_relationships",
      "learning_lesson_activity",
    ]) expect(sql).toContain(`public.${table}`);
    expect(sql).toContain("prevent_learning_history_change");
    expect(sql).toContain("enable row level security");
  });
});
