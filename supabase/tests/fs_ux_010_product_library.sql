\set ON_ERROR_STOP on
-- FS-UX-010: Product Library RPC verification against the real migration chain.
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,crypt('Local-FSUX010-Only!',gen_salt('bf')),now(),'{}','{}',now(),now()
from (values
  ('e1000000-0000-4000-8000-000000000001'::uuid,'fs-ux-010-admin@example.invalid'),
  ('e1000000-0000-4000-8000-000000000002'::uuid,'fs-ux-010-nonadmin@example.invalid')
) fixture(id,email) on conflict(id) do nothing;

insert into public.profiles(id,email,full_name,role) values
('e1000000-0000-4000-8000-000000000001','fs-ux-010-admin@example.invalid','FS-UX-010 Admin','admin'),
('e1000000-0000-4000-8000-000000000002','fs-ux-010-nonadmin@example.invalid','FS-UX-010 Non Admin','owner')
on conflict(id) do update set role=excluded.role;

create temporary table fsux010_ctx as
select
  (select id from public.furnishing_product_categories where slug='tables') as category_id,
  (select id from public.furnishing_room_types where id='living_room') as room_id,
  (select id from public.furnishing_style_tags where slug='modern') as style_id;

-- The RPCs are security definer and authorize purely off the
-- request.jwt.claim.sub GUC (via auth.uid()/is_admin()); verification
-- queries run as the connecting superuser so they can inspect state
-- regardless of the authenticated role's own table grants.
-- 1. Authorized create succeeds and is immediately readable.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',false);

do $$
declare ctx record; result jsonb; v_product_id uuid; v_revision bigint;
begin
  select * into ctx from fsux010_ctx;
  select public.create_furnishing_library_product(jsonb_build_object(
    'correlation_id',gen_random_uuid(),
    'idempotency_key','fsux010-test-create-1',
    'submitted_url','https://www.example.com/products/arched-oak-coffee-table?utm_source=test',
    'canonical_url','https://www.example.com/products/arched-oak-coffee-table',
    'name','Arched Oak Coffee Table',
    'category_id',ctx.category_id,
    'room_type_ids',jsonb_build_array(ctx.room_id),
    'style_tag_ids',jsonb_build_array(ctx.style_id),
    'listed_price_minor','18900',
    'currency','USD'
  )) into result;
  if result->>'status'<>'created' then raise exception 'FSUX010_CREATE_UNEXPECTED_STATUS: %', result; end if;
  v_product_id:=(result->>'productId')::uuid;
  select revision into v_revision from public.furnishing_products where id=v_product_id;
  if v_revision is null then raise exception 'FSUX010_CREATE_NOT_PERSISTED'; end if;
  if not exists(select 1 from public.furnishing_products where id=v_product_id and scope='platform' and workspace_id is null and status='draft') then
    raise exception 'FSUX010_CREATE_WRONG_SCOPE_OR_STATUS';
  end if;
  if not exists(select 1 from public.furnishing_product_room_compatibility where product_id=v_product_id and room_type_id=ctx.room_id) then
    raise exception 'FSUX010_CREATE_ROOM_MISSING';
  end if;
  if not exists(select 1 from public.furnishing_catalog_activity where product_id=v_product_id and event_type='furnishing_library_product_created' and (metadata->>'externalEffects')::boolean=false) then
    raise exception 'FSUX010_CREATE_ACTIVITY_MISSING_OR_HAS_EXTERNAL_EFFECTS';
  end if;
end $$;

-- 2. Idempotent retry with the same idempotency key returns the original product, not a duplicate row.
do $$
declare ctx record; first_result jsonb; replay_result jsonb; count_before int; count_after int;
begin
  select * into ctx from fsux010_ctx;
  select count(*) into count_before from public.furnishing_products where scope='platform';
  select public.create_furnishing_library_product(jsonb_build_object(
    'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-create-1',
    'submitted_url','https://www.example.com/products/arched-oak-coffee-table?utm_source=test',
    'canonical_url','https://www.example.com/products/arched-oak-coffee-table',
    'name','Arched Oak Coffee Table','category_id',ctx.category_id,
    'room_type_ids',jsonb_build_array(ctx.room_id)
  )) into replay_result;
  select count(*) into count_after from public.furnishing_products where scope='platform';
  if replay_result->>'status'<>'replayed' then raise exception 'FSUX010_REPLAY_UNEXPECTED_STATUS: %', replay_result; end if;
  if count_after<>count_before then raise exception 'FSUX010_REPLAY_CREATED_DUPLICATE_ROW'; end if;
end $$;

-- 3. A different idempotency key but the same canonical URL is detected as a duplicate
--    (pre-check) and does not create a second row.
do $$
declare ctx record; result jsonb; count_before int; count_after int;
begin
  select * into ctx from fsux010_ctx;
  select count(*) into count_before from public.furnishing_products where scope='platform';
  select public.create_furnishing_library_product(jsonb_build_object(
    'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-create-2-different-session',
    'submitted_url','https://www.example.com/products/arched-oak-coffee-table',
    'canonical_url','https://www.example.com/products/arched-oak-coffee-table',
    'name','Arched Oak Coffee Table (resubmitted)','category_id',ctx.category_id,
    'room_type_ids',jsonb_build_array(ctx.room_id)
  )) into result;
  select count(*) into count_after from public.furnishing_products where scope='platform';
  if result->>'status'<>'duplicate' then raise exception 'FSUX010_DUPLICATE_NOT_DETECTED: %', result; end if;
  if result->>'existingProductId' is null then raise exception 'FSUX010_DUPLICATE_MISSING_EXISTING_ID'; end if;
  if count_after<>count_before then raise exception 'FSUX010_DUPLICATE_PRECHECK_CREATED_ROW'; end if;
end $$;

-- 4. A genuinely different product (different canonical URL) is distinguishable and creates a new row.
do $$
declare ctx record; result jsonb;
begin
  select * into ctx from fsux010_ctx;
  select public.create_furnishing_library_product(jsonb_build_object(
    'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-create-variant',
    'submitted_url','https://www.example.com/products/arched-oak-coffee-table-large',
    'canonical_url','https://www.example.com/products/arched-oak-coffee-table-large',
    'name','Arched Oak Coffee Table (Large)','category_id',ctx.category_id,
    'room_type_ids',jsonb_build_array(ctx.room_id)
  )) into result;
  if result->>'status'<>'created' then raise exception 'FSUX010_VARIANT_NOT_DISTINGUISHABLE: %', result; end if;
end $$;

-- 5. Forcing creation over an in-transaction identity conflict still fails hard
--    (an exact duplicate can never be force-created twice).
do $$
declare ctx record;
begin
  select * into ctx from fsux010_ctx;
  begin
    perform public.create_furnishing_library_product(jsonb_build_object(
      'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-force-exact-duplicate',
      'submitted_url','https://www.example.com/products/arched-oak-coffee-table',
      'canonical_url','https://www.example.com/products/arched-oak-coffee-table',
      'name','Arched Oak Coffee Table (forced)','category_id',ctx.category_id,
      'room_type_ids',jsonb_build_array(ctx.room_id),
      'force_create',true
    ));
    raise exception 'FSUX010_FORCED_EXACT_DUPLICATE_ACCEPTED';
  exception when raise_exception then
    if sqlerrm<>'CATALOG_CANONICAL_URL_ALREADY_CLAIMED' then raise; end if;
  end;
end $$;

-- 6. Missing required fields are rejected.
do $$
begin
  begin
    perform public.create_furnishing_library_product(jsonb_build_object(
      'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-missing-fields',
      'canonical_url','https://www.example.com/products/incomplete'
    ));
    raise exception 'FSUX010_INCOMPLETE_COMMAND_ACCEPTED';
  exception when raise_exception then
    if sqlerrm<>'CATALOG_LIBRARY_CREATE_COMMAND_INVALID' then raise; end if;
  end;
end $$;

-- 7. Archive is idempotent and preserves the row (no destructive delete).
do $$
declare ctx record; v_product_id uuid; v_revision bigint; first_archive jsonb; replay_archive jsonb;
begin
  select id,revision into v_product_id,v_revision from public.furnishing_products
    where scope='platform' and name='Arched Oak Coffee Table' limit 1;
  select public.archive_furnishing_library_product(jsonb_build_object(
    'product_id',v_product_id,'expected_revision',v_revision,'reason','Test archive',
    'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-archive-1'
  )) into first_archive;
  if first_archive->>'status'<>'archived' then raise exception 'FSUX010_ARCHIVE_UNEXPECTED_STATUS: %', first_archive; end if;
  if not exists(select 1 from public.furnishing_products where id=v_product_id and status='archived') then
    raise exception 'FSUX010_ARCHIVE_STATUS_NOT_APPLIED';
  end if;
  select public.archive_furnishing_library_product(jsonb_build_object(
    'product_id',v_product_id,'expected_revision',v_revision,'reason','Test archive',
    'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-archive-1'
  )) into replay_archive;
  if replay_archive->>'status'<>'replayed' then raise exception 'FSUX010_ARCHIVE_REPLAY_UNEXPECTED_STATUS: %', replay_archive; end if;
end $$;

-- 8. Unauthorized (non-admin) actors are denied.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',false);
do $$
declare ctx record;
begin
  select * into ctx from fsux010_ctx;
  begin
    perform public.create_furnishing_library_product(jsonb_build_object(
      'correlation_id',gen_random_uuid(),'idempotency_key','fsux010-test-unauthorized',
      'submitted_url','https://www.example.com/products/unauthorized',
      'canonical_url','https://www.example.com/products/unauthorized',
      'name','Unauthorized Attempt','category_id',ctx.category_id,
      'room_type_ids',jsonb_build_array(ctx.room_id)
    ));
    raise exception 'FSUX010_UNAUTHORIZED_CREATE_ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm<>'FURNISHING_CATALOG_ADMIN_REQUIRED' then raise; end if;
  end;
end $$;

-- 9. Taxonomy backfill is idempotent: re-running the identical insert logic a
--    second time must not create duplicate style tags or duplicate assignments.
do $$
declare tags_before int; tags_after int; assignments_before int; assignments_after int;
begin
  select count(*) into tags_before from public.furnishing_style_tags;
  select count(*) into assignments_before from public.furnishing_product_style_tags;

  insert into public.furnishing_style_tags(slug,name)
  select distinct trim(both '-' from regexp_replace(lower(trim(tag)),'[^a-z0-9]+','-','g')) as slug, initcap(trim(tag)) as name
  from public.furnishing_products, unnest(style_tags) as tag
  where trim(tag)<>''
  on conflict(slug) do nothing;

  insert into public.furnishing_product_style_tags(product_id,style_tag_id)
  select p.id,st.id
  from public.furnishing_products p
  cross join lateral unnest(p.style_tags) as tag
  join public.furnishing_style_tags st
    on st.slug=trim(both '-' from regexp_replace(lower(trim(tag)),'[^a-z0-9]+','-','g'))
  where trim(tag)<>''
  on conflict do nothing;

  select count(*) into tags_after from public.furnishing_style_tags;
  select count(*) into assignments_after from public.furnishing_product_style_tags;
  if tags_after<>tags_before then raise exception 'FSUX010_TAXONOMY_BACKFILL_NOT_IDEMPOTENT_TAGS'; end if;
  if assignments_after<>assignments_before then raise exception 'FSUX010_TAXONOMY_BACKFILL_NOT_IDEMPOTENT_ASSIGNMENTS'; end if;
end $$;

rollback;
select 'FS-UX-010 product library verification passed' as result;
