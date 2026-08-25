-- FS-008D: authenticated import ledger and immutable snapshot commands.
create or replace function public.create_fs008d_import_run(
  p_source_filename text,
  p_source_sha256 text,
  p_source_reference text,
  p_correlation_id text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'UNAUTHORIZED'; end if;
  if length(trim(coalesce(p_source_sha256,''))) <> 64 then raise exception 'SOURCE_HASH_INVALID'; end if;
  select * into r from public.fs008d_import_runs where idempotency_key=p_idempotency_key for update;
  if found then
    if r.source_sha256<>lower(p_source_sha256) or r.source_filename<>p_source_filename then raise exception 'IMPORT_REPLAY_CONFLICT'; end if;
    return jsonb_build_object('status','replayed','id',r.id,'state',r.state,'expected_version',r.expected_version);
  end if;
  insert into public.fs008d_import_runs(source_filename,source_sha256,source_reference,correlation_id,idempotency_key,state)
    values(left(trim(p_source_filename),255),lower(p_source_sha256),left(trim(p_source_reference),500),left(trim(p_correlation_id),120),left(trim(p_idempotency_key),160),'uploaded') returning * into r;
  return jsonb_build_object('status','created','id',r.id,'state',r.state,'expected_version',r.expected_version);
end $$;

create or replace function public.record_fs008d_import_row(
  p_import_id uuid, p_expected_version integer, p_sheet_name text, p_source_row integer,
  p_outcome text, p_formula_present boolean, p_formula_hash text, p_cached_value jsonb,
  p_canonical_value jsonb, p_validation_reasons text[], p_raw_source jsonb,
  p_correlation_id text, p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare i record; r record;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'UNAUTHORIZED'; end if;
  select * into i from public.fs008d_import_runs where id=p_import_id for update;
  if not found or i.expected_version<>p_expected_version then raise exception 'IMPORT_VERSION_CONFLICT'; end if;
  insert into public.fs008d_import_rows(import_id,sheet_name,source_row,outcome,formula_present,formula_hash,cached_value,canonical_value,validation_reasons,raw_source)
    values(p_import_id,left(p_sheet_name,120),p_source_row,p_outcome,p_formula_present,left(p_formula_hash,128),p_cached_value,p_canonical_value,coalesce(p_validation_reasons,'{}'),coalesce(p_raw_source,'{}'))
    on conflict(import_id,sheet_name,source_row) do update set outcome=excluded.outcome, formula_present=excluded.formula_present, formula_hash=excluded.formula_hash, cached_value=excluded.cached_value, canonical_value=excluded.canonical_value, validation_reasons=excluded.validation_reasons, raw_source=excluded.raw_source
    returning * into r;
  update public.fs008d_import_runs set total_rows=(select count(*) from public.fs008d_import_rows where import_id=p_import_id), expected_version=expected_version+1, state='review_required', updated_at=now() where id=p_import_id;
  return jsonb_build_object('status','recorded','id',r.id,'import_id',p_import_id);
end $$;

revoke all on function public.create_fs008d_import_run(text,text,text,text,text), public.record_fs008d_import_row(uuid,integer,text,integer,text,boolean,text,jsonb,jsonb,text[],jsonb,text,text) from public,anon;
grant execute on function public.create_fs008d_import_run(text,text,text,text,text), public.record_fs008d_import_row(uuid,integer,text,integer,text,boolean,text,jsonb,jsonb,text[],jsonb,text,text) to authenticated;
