-- IA-001C: operator notes and atomic note/activity/version persistence.
create table public.investment_opportunity_notes (
  id text primary key,
  opportunity_id text not null references public.investment_opportunities(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_by jsonb not null check (jsonb_typeof(created_by) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz
);
create index investment_opportunity_notes_order_idx on public.investment_opportunity_notes(opportunity_id, created_at desc, id);
alter table public.investment_opportunity_notes enable row level security;
create policy "Owners read Investment Opportunity notes" on public.investment_opportunity_notes for select to authenticated using (exists (select 1 from public.investment_opportunities opportunity where opportunity.id = opportunity_id and (opportunity.owner_id = auth.uid() or public.is_admin())));
grant select on public.investment_opportunity_notes to authenticated;

create table public.investment_analysis_save_tokens (
  token_hash text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  analyzed_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index investment_analysis_save_tokens_owner_expiry_idx on public.investment_analysis_save_tokens(owner_id, expires_at);
alter table public.investment_analysis_save_tokens enable row level security;
create policy "Owners manage own Investment Analysis save tokens" on public.investment_analysis_save_tokens for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
grant select, insert, delete on public.investment_analysis_save_tokens to authenticated;

alter table public.investment_opportunity_activity drop constraint investment_opportunity_activity_type_check;
alter table public.investment_opportunity_activity add constraint investment_opportunity_activity_type_check check (type in ('opportunity-created', 'analysis-saved', 'status-changed', 'name-changed', 'tags-changed', 'note-added', 'opportunity-archived', 'opportunity-restored'));

create or replace function public.add_investment_opportunity_note(p_opportunity_id text, p_note jsonb, p_activity jsonb, p_expected_version integer, p_command_id text)
returns integer language plpgsql security definer set search_path = public as $$
declare current_row public.investment_opportunities; existing_version integer;
begin
  select * into current_row from public.investment_opportunities where id=p_opportunity_id for update;
  if not found or auth.uid() is null or (current_row.owner_id <> auth.uid() and not public.is_admin()) then raise exception 'Investment Opportunity not found' using errcode='42501'; end if;
  if current_row.archived_at is not null then raise exception 'Archived opportunity cannot receive notes' using errcode='P0001'; end if;
  if current_row.version <> p_expected_version then raise exception 'Stale Investment Opportunity version' using errcode='40001'; end if;
  select aggregate_version into existing_version from public.investment_opportunity_activity where opportunity_id=p_opportunity_id and command_id=p_command_id and type='note-added' limit 1;
  if found then return existing_version; end if;
  insert into public.investment_opportunity_notes select * from jsonb_populate_record(null::public.investment_opportunity_notes, p_note);
  insert into public.investment_opportunity_activity select * from jsonb_populate_record(null::public.investment_opportunity_activity, p_activity);
  update public.investment_opportunities set version=version+1, updated_at=(p_activity->>'occurred_at')::timestamptz where id=p_opportunity_id;
  return p_expected_version+1;
end; $$;
revoke all on function public.add_investment_opportunity_note(text,jsonb,jsonb,integer,text) from public;
grant execute on function public.add_investment_opportunity_note(text,jsonb,jsonb,integer,text) to authenticated;
