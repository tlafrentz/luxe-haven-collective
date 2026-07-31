-- Investment Report Sharing v1: opaque expiring grants and privacy-conscious access history.
begin;

create table public.investment_report_shares(
  id text primary key check(id like 'investment-report-share-%'),
  owner_profile_id uuid not null references auth.users(id),
  report_id text not null references public.generated_reports(id) on delete restrict,
  credential_digest text not null check(credential_digest ~ '^[0-9a-f]{64}$'),
  credential_version text not null default 'sha256.v1',
  share_policy_version text not null default 'investment-report-sharing.v1',
  report_schema_version text not null,
  export_template_version text,
  recipient_label text,
  allow_pdf_download boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by_profile_id uuid references auth.users(id),
  replaces_share_id text references public.investment_report_shares(id) on delete restrict,
  replaced_by_share_id text references public.investment_report_shares(id) on delete restrict,
  idempotency_key text not null,
  check(expires_at>created_at),
  check(recipient_label is null or char_length(recipient_label)<=160),
  check((revoked_at is null and revoked_by_profile_id is null)or(revoked_at is not null and revoked_by_profile_id is not null)),
  unique(owner_profile_id,idempotency_key),
  unique(credential_digest)
);

create table public.investment_report_share_access(
  id text primary key check(id like 'investment-report-share-access-%'),
  share_id text not null references public.investment_report_shares(id) on delete restrict,
  event_type text not null check(event_type in('report-opened','pdf-downloaded','access-rejected','share-revoked','replacement-created')),
  outcome text not null check(outcome in('granted','completed','expired','revoked','invalid','not-permitted','failed')),
  client_class text not null default 'browser' check(client_class in('browser','automated','unknown')),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);

create index investment_report_shares_owner_report_idx on public.investment_report_shares(owner_profile_id,report_id,created_at desc);
create index investment_report_shares_active_idx on public.investment_report_shares(report_id,expires_at) where revoked_at is null;
create index investment_report_shares_digest_idx on public.investment_report_shares(credential_digest);
create index investment_report_share_access_history_idx on public.investment_report_share_access(share_id,occurred_at desc);

alter table public.investment_report_shares enable row level security;
alter table public.investment_report_share_access enable row level security;

create policy "Owners read investment report shares" on public.investment_report_shares for select to authenticated
  using(owner_profile_id=auth.uid());
create policy "Owners read investment report share access" on public.investment_report_share_access for select to authenticated
  using(exists(select 1 from public.investment_report_shares share where share.id=share_id and share.owner_profile_id=auth.uid()));

grant select on public.investment_report_shares,public.investment_report_share_access to authenticated;
revoke all on public.investment_report_shares,public.investment_report_share_access from anon;

create or replace function public.create_investment_report_share_v1(
  p_share_id text,p_report_id text,p_credential_digest text,p_duration_hours integer,
  p_recipient_label text,p_allow_pdf_download boolean,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_now timestamptz:=now();v_schema text;v_existing text;v_count integer;
begin
  if v_user is null then raise exception 'share_unauthorized';end if;
  if p_duration_hours not in(24,168,720) then raise exception 'share_expiration_invalid';end if;
  if p_share_id not like 'investment-report-share-%' or p_credential_digest !~ '^[0-9a-f]{64}$'
    or nullif(trim(p_idempotency_key),'')is null then raise exception 'share_input_invalid';end if;
  select id into v_existing from public.investment_report_shares where owner_profile_id=v_user and idempotency_key=p_idempotency_key;
  if v_existing is not null then return jsonb_build_object('shareId',v_existing,'existing',true);end if;
  select snapshot_schema_version into v_schema from public.generated_reports
    where id=p_report_id and report_type='investment-decision' and owner_profile_id=v_user;
  if v_schema is null then raise exception 'share_report_not_found';end if;
  select count(*) into v_count from public.investment_report_shares
    where report_id=p_report_id and revoked_at is null and expires_at>v_now;
  if v_count>=10 then raise exception 'share_active_limit_reached';end if;
  insert into public.investment_report_shares(
    id,owner_profile_id,report_id,credential_digest,recipient_label,allow_pdf_download,
    report_schema_version,export_template_version,created_at,expires_at,idempotency_key
  )values(
    p_share_id,v_user,p_report_id,p_credential_digest,nullif(trim(p_recipient_label),''),
    p_allow_pdf_download,v_schema,case when p_allow_pdf_download then'investment-report-pdf.v1'else null end,
    v_now,v_now+make_interval(hours=>p_duration_hours),p_idempotency_key
  );
  return jsonb_build_object('shareId',p_share_id,'existing',false,'expiresAt',(v_now+make_interval(hours=>p_duration_hours)));
end $$;

create or replace function public.revoke_investment_report_share_v1(p_share_id text)
returns text language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_report text;
begin
  if v_user is null then raise exception 'share_unauthorized';end if;
  select report_id into v_report from public.investment_report_shares where id=p_share_id and owner_profile_id=v_user for update;
  if v_report is null then raise exception 'share_not_found';end if;
  if exists(select 1 from public.investment_report_shares where id=p_share_id and revoked_at is not null) then raise exception 'share_lifecycle_conflict';end if;
  if exists(select 1 from public.investment_report_shares where id=p_share_id and expires_at<=now()) then raise exception 'share_lifecycle_conflict';end if;
  update public.investment_report_shares set revoked_at=now(),revoked_by_profile_id=v_user where id=p_share_id;
  insert into public.investment_report_share_access(id,share_id,event_type,outcome,client_class,correlation_id,occurred_at)
  values('investment-report-share-access-'||gen_random_uuid(),p_share_id,'share-revoked','completed','browser',gen_random_uuid(),now());
  return p_share_id;
end $$;

create or replace function public.replace_investment_report_share_v1(
  p_old_share_id text,p_new_share_id text,p_credential_digest text,p_duration_hours integer,
  p_recipient_label text,p_allow_pdf_download boolean,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_now timestamptz:=now();v_old public.investment_report_shares%rowtype;
begin
  if v_user is null then raise exception 'share_unauthorized';end if;
  if p_duration_hours not in(24,168,720) then raise exception 'share_expiration_invalid';end if;
  select * into v_old from public.investment_report_shares where id=p_old_share_id and owner_profile_id=v_user for update;
  if v_old.id is null then raise exception 'share_not_found';end if;
  if v_old.revoked_at is not null or v_old.expires_at<=v_now then raise exception 'share_lifecycle_conflict';end if;
  if exists(select 1 from public.investment_report_shares where owner_profile_id=v_user and idempotency_key=p_idempotency_key) then raise exception 'share_create_conflict';end if;
  insert into public.investment_report_shares(
    id,owner_profile_id,report_id,credential_digest,recipient_label,allow_pdf_download,
    report_schema_version,export_template_version,created_at,expires_at,replaces_share_id,idempotency_key
  )values(
    p_new_share_id,v_user,v_old.report_id,p_credential_digest,nullif(trim(p_recipient_label),''),
    p_allow_pdf_download,v_old.report_schema_version,case when p_allow_pdf_download then'investment-report-pdf.v1'else null end,
    v_now,v_now+make_interval(hours=>p_duration_hours),p_old_share_id,p_idempotency_key
  );
  update public.investment_report_shares set revoked_at=v_now,revoked_by_profile_id=v_user,replaced_by_share_id=p_new_share_id where id=p_old_share_id;
  insert into public.investment_report_share_access(id,share_id,event_type,outcome,client_class,correlation_id,occurred_at)
  values('investment-report-share-access-'||gen_random_uuid(),p_old_share_id,'replacement-created','completed','browser',gen_random_uuid(),v_now);
  return jsonb_build_object('shareId',p_new_share_id,'existing',false,'expiresAt',(v_now+make_interval(hours=>p_duration_hours)));
end $$;

revoke all on function public.create_investment_report_share_v1(text,text,text,integer,text,boolean,text) from public;
revoke all on function public.revoke_investment_report_share_v1(text) from public;
revoke all on function public.replace_investment_report_share_v1(text,text,text,integer,text,boolean,text) from public;
grant execute on function public.create_investment_report_share_v1(text,text,text,integer,text,boolean,text) to authenticated;
grant execute on function public.revoke_investment_report_share_v1(text) to authenticated;
grant execute on function public.replace_investment_report_share_v1(text,text,text,integer,text,boolean,text) to authenticated;

commit;
