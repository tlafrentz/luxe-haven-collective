-- FS-008D: canonical import governance and immutable project catalog snapshots.
create table if not exists public.fs008d_import_runs(
 id uuid primary key default gen_random_uuid(), workspace_id uuid, source_filename text not null, source_sha256 text not null,
 source_reference text not null, correlation_id text not null, idempotency_key text not null unique, expected_version integer not null default 1,
 state text not null default 'uploaded' check(state in('uploaded','parsing','review_required','draft_created','failed','completed')),
 total_rows integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(source_sha256,idempotency_key)
);
create table if not exists public.fs008d_import_rows(
 id uuid primary key default gen_random_uuid(), import_id uuid not null references public.fs008d_import_runs(id) on delete cascade,
 sheet_name text not null, source_row integer not null, source_cell text, outcome text not null check(outcome in('valid','warning','needs_mapping','duplicate','incomplete','unsupported_retailer','invalid_offer','rejected','ready_for_review')),
 formula_present boolean not null default false, formula_hash text, cached_value jsonb, canonical_value jsonb, product_id uuid, offer_id uuid, package_version_id uuid,
 validation_reasons text[] not null default '{}', raw_source jsonb not null default '{}', unique(import_id,sheet_name,source_row)
);
create table if not exists public.fs008d_project_catalog_snapshots(
 id uuid primary key default gen_random_uuid(), project_id uuid not null, tenant_id uuid not null, catalog_version_id uuid, package_version_id uuid not null,
 snapshot jsonb not null, content_hash text not null, correlation_id text not null, created_at timestamptz not null default now(), unique(project_id,package_version_id), unique(project_id,content_hash)
);
alter table public.fs008d_import_runs enable row level security; alter table public.fs008d_import_rows enable row level security; alter table public.fs008d_project_catalog_snapshots enable row level security;
create policy "Admins read FS008D imports" on public.fs008d_import_runs for select to authenticated using(public.is_admin());
create policy "Admins read FS008D rows" on public.fs008d_import_rows for select to authenticated using(exists(select 1 from public.fs008d_import_runs i where i.id=import_id and public.is_admin()));
create policy "Owners read own FS008D snapshots" on public.fs008d_project_catalog_snapshots for select to authenticated using(tenant_id in(select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active'));
create policy "Admins read FS008D snapshots" on public.fs008d_project_catalog_snapshots for select to authenticated using(public.is_admin());
revoke all on public.fs008d_import_runs,public.fs008d_import_rows,public.fs008d_project_catalog_snapshots from anon;
revoke insert,update,delete on public.fs008d_import_runs,public.fs008d_import_rows,public.fs008d_project_catalog_snapshots from authenticated;
