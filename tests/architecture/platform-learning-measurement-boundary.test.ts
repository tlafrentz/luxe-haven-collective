import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Platform Learning measurement boundary", () => {
  it("depends on measurement ports rather than feature repositories", () => {
    const source = readFileSync(
      "src/platform/learning/application/outcome-review-services.ts",
      "utf8",
    );
    expect(source).not.toMatch(/features\/|supabase|stripe/i);
    expect(source).toContain("LearningMeasurementSourcePort");
  });

  it("persists versioned plans, measurements, reviews, jobs, and RLS", () => {
    const sql = readFileSync(
      "supabase/migrations/20260726080000_learning_outcome_measurement.sql",
      "utf8",
    );
    for (const table of [
      "learning_measurement_plan_versions",
      "learning_review_schedules",
      "learning_outcome_review_revisions",
      "learning_measured_outcome_revisions",
      "learning_measurement_jobs",
      "learning_measurement_command_receipts",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("protect_learning_plan_version");
    expect(sql).toContain("prevent_learning_history_change");
  });
});
