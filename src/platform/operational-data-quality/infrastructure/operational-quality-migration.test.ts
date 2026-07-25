import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260724140000_operational_data_quality.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("operational quality persistence migration", () => {
  it("is forward-only and supports incremental unknown evaluation", () => {
    expect(migration).toContain("status text not null default 'unknown'");
    expect(migration).toContain("operational_quality_re_evaluation_queue");
    expect(migration).not.toMatch(/drop table|truncate/i);
    expect(migration.toLowerCase()).not.toContain(
      "alter table public.bookings drop column",
    );
  });

  it("indexes workspace summaries and issue lists", () => {
    expect(migration).toContain(
      "operational_quality_evaluations_owner_status_idx",
    );
    expect(migration).toContain("operational_data_quality_issues_open_idx");
    expect(migration).toContain("operational_sync_summaries_owner_started_idx");
  });

  it("enforces workspace RLS without exposing provenance broadly", () => {
    expect(migration).toContain(
      "alter table public.operational_quality_evaluations enable row level security",
    );
    expect(migration).toContain("using (owner_id = auth.uid())");
    expect(migration).not.toContain(
      'create policy "Owners read own operational provenance"',
    );
  });
});
