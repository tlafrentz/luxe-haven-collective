-- Phase 0 of UX-003: retire the pre-FS-001 status vocabulary. FS-001 added
-- lifecycle_status alongside the original status/phase columns instead of
-- replacing them, leaving two status models on the same rows. The canonical
-- FS-00N action layer (furnishing-project-workspace.ts, furnishing-packages.ts)
-- reads/writes lifecycle_status exclusively and never touches status/phase
-- (verified by code search before writing this migration). Only the legacy
-- furnishing-studio.ts stack (being deleted in the same pass) used status/phase.
--
-- Scope is deliberately narrow: only the ambiguous lifecycle columns are
-- dropped here. Other legacy-only columns (package_snapshot, budget jsonb,
-- selections, scope, owner_name, project_lead, target_install_date,
-- package_id, variant_id, created_by, progress) are inert leftover data, not
-- a dual-source-of-truth risk, and are left for a later cleanup pass.
begin;

alter table public.furnishing_projects
  drop column if exists status,
  drop column if exists phase;

alter table public.furnishing_packages
  drop column if exists status;

commit;
