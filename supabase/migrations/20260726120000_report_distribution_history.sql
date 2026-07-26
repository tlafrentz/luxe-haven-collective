-- REP v1.2: governed report distribution, sharing policy, and historical metadata.
begin;

alter table public.report_shares
  add column if not exists recipient_label text,
  add column if not exists notes text,
  add column if not exists watermark text,
  add column if not exists confidentiality_level text not null default 'confidential'
    check(confidentiality_level in('standard','confidential','strictly-confidential')),
  add column if not exists download_count integer not null default 0 check(download_count>=0);

create table public.report_sharing_policies(
  id text primary key,
  workspace_id uuid not null,
  report_type text not null check(report_type in('investment-decision','property-performance','portfolio-performance','financial-performance')),
  external_access text not null check(external_access in('allowed','internal-only')),
  allowed_access_modes text[] not null default array['view'],
  maximum_expiration_days integer not null default 90 check(maximum_expiration_days between 1 and 365),
  require_expiration boolean not null default true,
  require_recipient_label boolean not null default false,
  default_confidentiality_level text not null default 'confidential',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,report_type)
);
alter table public.report_sharing_policies enable row level security;
create policy "Workspace sharing policies are readable" on public.report_sharing_policies for select to authenticated
  using(public.active_workspace_role(workspace_id)is not null);
grant select on public.report_sharing_policies to authenticated;

create index generated_reports_history_idx on public.generated_reports(workspace_id,series_key,version_number desc);
create index report_shares_governance_idx on public.report_shares(report_id,status,created_at desc);

commit;
