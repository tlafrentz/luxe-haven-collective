-- Completes an interrupted FS-008G/C8 Production browser-verification run.
-- scripts/verification/verify-fs008g-c8-browser.ts creates a furnishing
-- project literally named 'C8-D Isolated Furnishing Lifecycle' (see that
-- script's owner-project step) but that run stopped early at its first
-- activation stage per docs/verification/fs-ux-009-program-reconciliation.md
-- ("The integrated authenticated browser lifecycle remains unproven...")
-- and never reached its own final cleanup step. This is not the one
-- pre-existing Production furnishing project (a different name, retained
-- with its August 5, 2026 timestamp per that same record) — it is a
-- clearly-designated, non-customer verification fixture.
--
-- This only sets design_workspace_status, which the Design Workspaces list
-- reads and which the archived-dependency guard trigger does not consult
-- (that trigger checks the separate lifecycle_status column) — no
-- deletion, no other column touched, all evidence/history retained.
begin;

do $$
declare archived_count int;
begin
  update public.furnishing_projects
  set design_workspace_status='archived', updated_at=now()
  where name='C8-D Isolated Furnishing Lifecycle' and design_workspace_status<>'archived';
  get diagnostics archived_count = row_count;
  raise notice 'Archived % C8-D Isolated Furnishing Lifecycle fixture project(s)', archived_count;
end $$;

commit;
