-- FS-UX-010: simplified Furnishing Product Library.
-- Adds a governed, admin-gated create/archive RPC pair for platform-scope
-- library products (add-by-link), generalizes the existing FS-UX-002 identity
-- claim mechanism to also cover platform scope and canonical-URL identity,
-- and adds a lightweight style-tag taxonomy. No capability state, external
-- provider, procurement, payment, notification, or installation effects.
begin;

-- 1. New columns -------------------------------------------------------

alter table public.furnishing_products
  add column if not exists extracted_snapshot jsonb;

alter table public.furnishing_product_offers
  add column if not exists original_url text,
  add column if not exists extraction_source text
    check(extraction_source is null or extraction_source in('retailer_integration','json_ld','open_graph','html_heuristic','manual')),
  add column if not exists extraction_confidence text
    check(extraction_confidence is null or extraction_confidence in('high','medium','low'));

-- Add-by-link products are not required to carry a retailer (spec §6.4
-- makes retailer optional); the FS-001 schema required it.
alter table public.furnishing_product_offers alter column retailer_id drop not null;

-- 2. Generalize duplicate identity to cover platform scope --------------

alter table public.furnishing_product_identity_claims alter column workspace_id drop not null;

create unique index if not exists furnishing_product_identity_claims_platform_uq
  on public.furnishing_product_identity_claims(identity_kind, identity_key)
  where workspace_id is null;

do $$
declare cname text;
begin
  select conname into cname from pg_constraint
    where conrelid='public.furnishing_product_identity_claims'::regclass
      and contype='c' and pg_get_constraintdef(oid) ilike '%identity_kind%';
  if cname is not null then
    execute format('alter table public.furnishing_product_identity_claims drop constraint %I', cname);
  end if;
end $$;
alter table public.furnishing_product_identity_claims
  add constraint furnishing_product_identity_claims_identity_kind_check
  check(identity_kind in('platform_source','normalized_product','retailer_sku','canonical_url'));

drop function if exists public.canonical_furnishing_product_identity(text,uuid,text,text,text,uuid,text,jsonb);
create or replace function public.canonical_furnishing_product_identity(
  p_kind text,p_source_product_id uuid,p_name text,p_brand text,p_manufacturer_part_number text,
  p_retailer_id uuid,p_sku text,p_variant jsonb,p_canonical_url text default null
) returns text language sql immutable set search_path=public,extensions,pg_temp as $$
 select encode(digest(concat_ws('|','fs-product-identity-v1',p_kind,
   coalesce(p_source_product_id::text,'<null>'),lower(regexp_replace(trim(coalesce(p_name,'')),'\s+',' ','g')),
   lower(regexp_replace(trim(coalesce(p_brand,'')),'\s+',' ','g')),
   lower(regexp_replace(trim(coalesce(p_manufacturer_part_number,'')),'\s+',' ','g')),
   coalesce(p_retailer_id::text,'<null>'),lower(regexp_replace(trim(coalesce(p_sku,'')),'\s+',' ','g')),
   coalesce(p_variant,'{}'::jsonb)::text,lower(coalesce(p_canonical_url,'<null>'))),'sha256'),'hex')
$$;

-- Generalized claim function: works for both scopes. Advisory-locks by
-- workspace for workspace scope (unchanged behavior) or by a fixed constant
-- for platform scope, so concurrent platform submissions of the same
-- identity serialize to one winner.
create or replace function public.claim_furnishing_product_identity(
  p_product_id uuid,p_source_product_id uuid default null,p_snapshot jsonb default null
) returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare p public.furnishing_products%rowtype; o record; snap jsonb; variant jsonb; identity text; conflict record; lock_key bigint;
begin
 select * into p from public.furnishing_products where id=p_product_id for update;
 if not found then raise exception 'CATALOG_IDENTITY_TARGET_INVALID'; end if;
 if p.scope='workspace' then
   if p.workspace_id is null then raise exception 'CATALOG_IDENTITY_TARGET_INVALID'; end if;
   lock_key:=hashtextextended('furnishing-product-identity:'||p.workspace_id::text,0);
 else
   lock_key:=hashtextextended('furnishing-product-identity:platform',0);
 end if;
 perform pg_advisory_xact_lock(lock_key);
 snap:=coalesce(p_snapshot,to_jsonb(p));
 variant:=jsonb_strip_nulls(jsonb_build_object('color',snap->'color','material',snap->'material','finish',snap->'finish','dimensions',snap->'dimensions'));
 delete from public.furnishing_product_identity_claims where product_id=p.id and identity_kind in('normalized_product','retailer_sku','canonical_url');

 identity:=public.canonical_furnishing_product_identity('normalized_product',null,snap->>'name',snap->>'brand',snap->>'manufacturer_part_number',null,null,variant);
 select c.*,x.status as product_status into conflict from public.furnishing_product_identity_claims c join public.furnishing_products x on x.id=c.product_id where c.workspace_id is not distinct from p.workspace_id and c.identity_kind='normalized_product' and c.identity_key=identity and c.product_id<>p.id;
 if found then
   if conflict.retired_at is not null or conflict.product_status in('discontinued','archived') then raise exception 'CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT'; end if;
   raise exception 'CATALOG_WORKSPACE_IDENTITY_CONFLICT';
 end if;
 insert into public.furnishing_product_identity_claims(workspace_id,product_id,identity_kind,identity_key,lifecycle_status)
 values(p.workspace_id,p.id,'normalized_product',identity,p.status)
 on conflict(product_id,identity_kind,identity_key) do update set lifecycle_status=excluded.lifecycle_status;

 if p_source_product_id is not null then
   identity:=public.canonical_furnishing_product_identity('platform_source',p_source_product_id,null,null,null,null,null,'{}');
   select c.*,x.status as product_status into conflict from public.furnishing_product_identity_claims c join public.furnishing_products x on x.id=c.product_id where c.workspace_id is not distinct from p.workspace_id and c.identity_kind='platform_source' and c.identity_key=identity and c.product_id<>p.id;
   if found then
     if conflict.retired_at is not null or conflict.product_status in('discontinued','archived') then raise exception 'CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT'; end if;
     raise exception 'CATALOG_PLATFORM_SOURCE_ALREADY_ADOPTED';
   end if;
   insert into public.furnishing_product_identity_claims(workspace_id,product_id,identity_kind,identity_key,lifecycle_status)
   values(p.workspace_id,p.id,'platform_source',identity,p.status)
   on conflict(product_id,identity_kind,identity_key) do update set lifecycle_status=excluded.lifecycle_status;
 end if;

 for o in select retailer_id,sku,product_url from public.furnishing_product_offers where product_id=p.id and status<>'archived' loop
   -- Only a genuine retailer+SKU pair is a real identity signal; without
   -- both, every no-retailer offer would hash identically and collide.
   if o.retailer_id is not null and nullif(trim(o.sku),'') is not null then
     identity:=public.canonical_furnishing_product_identity('retailer_sku',null,null,null,null,o.retailer_id,o.sku,variant);
     select c.*,x.status as product_status into conflict from public.furnishing_product_identity_claims c join public.furnishing_products x on x.id=c.product_id where c.workspace_id is not distinct from p.workspace_id and c.identity_kind='retailer_sku' and c.identity_key=identity and c.product_id<>p.id;
     if found then
       if conflict.retired_at is not null or conflict.product_status in('discontinued','archived') then raise exception 'CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT'; end if;
       raise exception 'CATALOG_RETAILER_SKU_IDENTITY_CONFLICT';
     end if;
     insert into public.furnishing_product_identity_claims(workspace_id,product_id,identity_kind,identity_key,lifecycle_status)
     values(p.workspace_id,p.id,'retailer_sku',identity,p.status)
     on conflict(product_id,identity_kind,identity_key) do update set lifecycle_status=excluded.lifecycle_status;
   end if;

   identity:=public.canonical_furnishing_product_identity('canonical_url',null,null,null,null,null,null,'{}'::jsonb,o.product_url);
   select c.*,x.status as product_status into conflict from public.furnishing_product_identity_claims c join public.furnishing_products x on x.id=c.product_id where c.workspace_id is not distinct from p.workspace_id and c.identity_kind='canonical_url' and c.identity_key=identity and c.product_id<>p.id;
   if found then
     if conflict.retired_at is not null or conflict.product_status in('discontinued','archived') then raise exception 'CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT'; end if;
     raise exception 'CATALOG_CANONICAL_URL_ALREADY_CLAIMED';
   end if;
   insert into public.furnishing_product_identity_claims(workspace_id,product_id,identity_kind,identity_key,lifecycle_status)
   values(p.workspace_id,p.id,'canonical_url',identity,p.status)
   on conflict(product_id,identity_kind,identity_key) do update set lifecycle_status=excluded.lifecycle_status;
 end loop;
end $$;

-- The original workspace-only entry point becomes a thin wrapper: same
-- signature, same guard/error for a non-workspace target, delegates the
-- actual claim logic. Existing callers/triggers are untouched.
create or replace function public.claim_furnishing_workspace_product_identity(
  p_product_id uuid,p_source_product_id uuid default null,p_snapshot jsonb default null
) returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare p public.furnishing_products%rowtype;
begin
 select * into p from public.furnishing_products where id=p_product_id;
 if not found or p.scope<>'workspace' or p.workspace_id is null then raise exception 'CATALOG_IDENTITY_TARGET_INVALID'; end if;
 perform public.claim_furnishing_product_identity(p_product_id,p_source_product_id,p_snapshot);
end $$;

-- Platform-scope sibling triggers (kept separate from the certified
-- workspace triggers rather than modifying them).
create or replace function public.enforce_furnishing_product_identity()
returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
 if new.scope<>'platform' then return new; end if;
 if new.status in('discontinued','archived') then
   update public.furnishing_product_identity_claims set lifecycle_status=new.status,retired_at=coalesce(retired_at,now()) where product_id=new.id;
 else
   perform public.claim_furnishing_product_identity(new.id,new.family_product_id,to_jsonb(new));
 end if;
 return new;
end $$;
drop trigger if exists furnishing_product_identity_enforced on public.furnishing_products;
create trigger furnishing_product_identity_enforced
after insert or update of scope,status,name,brand,manufacturer_part_number,color,material,finish,dimensions,family_product_id
on public.furnishing_products for each row execute function public.enforce_furnishing_product_identity();

create or replace function public.enforce_furnishing_platform_offer_identity()
returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare target uuid; p public.furnishing_products%rowtype;
begin
 target:=case when tg_op='DELETE' then old.product_id else new.product_id end;
 select * into p from public.furnishing_products where id=target;
 if found and p.scope='platform' then perform public.claim_furnishing_product_identity(p.id,p.family_product_id,to_jsonb(p)); end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists furnishing_platform_offer_identity_insert_delete on public.furnishing_product_offers;
create trigger furnishing_platform_offer_identity_insert_delete
after insert or delete on public.furnishing_product_offers
for each row execute function public.enforce_furnishing_platform_offer_identity();
drop trigger if exists furnishing_platform_offer_identity_update on public.furnishing_product_offers;
create trigger furnishing_platform_offer_identity_update
after update of product_id,retailer_id,sku,status on public.furnishing_product_offers
for each row execute function public.enforce_furnishing_platform_offer_identity();

-- 3. Governed RPCs for the Product Library --------------------------------

create index if not exists furnishing_catalog_activity_idempotency_idx
  on public.furnishing_catalog_activity((metadata->>'idempotencyKey'))
  where metadata ? 'idempotencyKey';

create or replace function public.create_furnishing_library_product(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  actor uuid:=auth.uid(); correlation uuid; command_key text; submitted_url text; canonical_url text;
  name text; category_id uuid; category_group text; room_ids text[]; force_create boolean;
  prior record; product public.furnishing_products%rowtype; offer_id uuid; existing_claim record; v_identity_key text;
begin
  if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501'; end if;
  begin correlation:=(p_input->>'correlation_id')::uuid; exception when others then raise exception 'CATALOG_LIBRARY_CREATE_COMMAND_INVALID'; end;
  command_key:=left(trim(p_input->>'idempotency_key'),200);
  submitted_url:=nullif(trim(p_input->>'submitted_url'),'');
  canonical_url:=nullif(trim(p_input->>'canonical_url'),'');
  name:=nullif(trim(p_input->>'name'),'');
  category_id:=nullif(p_input->>'category_id','')::uuid;
  room_ids:=coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_input->'room_type_ids','[]'::jsonb)) as value),'{}');
  force_create:=coalesce((p_input->>'force_create')::boolean,false);
  if length(command_key)<8 or canonical_url is null or name is null or category_id is null or array_length(room_ids,1) is null then
    raise exception 'CATALOG_LIBRARY_CREATE_COMMAND_INVALID';
  end if;

  select fp.id,fp.revision into prior from public.furnishing_products fp
    join public.furnishing_catalog_activity ca on ca.product_id=fp.id and ca.event_type='furnishing_library_product_created'
    where ca.metadata->>'idempotencyKey'=command_key limit 1;
  if found then
    select id into offer_id from public.furnishing_product_offers where product_id=prior.id order by created_at limit 1;
    return jsonb_build_object('status','replayed','productId',prior.id,'offerId',offer_id,'revision',prior.revision);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('furnishing-product-identity:platform',0));

  v_identity_key:=public.canonical_furnishing_product_identity('canonical_url',null,null,null,null,null,null,'{}'::jsonb,canonical_url);
  select c.product_id,x.name as product_name into existing_claim from public.furnishing_product_identity_claims c
    join public.furnishing_products x on x.id=c.product_id
    where c.workspace_id is null and c.identity_kind='canonical_url' and c.identity_key=v_identity_key
      and c.retired_at is null and x.status not in('discontinued','archived');
  if found and not force_create then
    return jsonb_build_object('status','duplicate','existingProductId',existing_claim.product_id,'existingProductName',existing_claim.product_name);
  end if;

  select group_name into category_group from public.furnishing_product_categories where id=category_id and status='active';
  if category_group is null then raise exception 'CATALOG_LIBRARY_CREATE_COMMAND_INVALID'; end if;

  insert into public.furnishing_products(
    workspace_id,name,description,product_type,category,category_id,brand,color,finish,
    status,scope,tags,created_by,updated_by,source_type,extracted_snapshot
  ) values(
    null,name,nullif(p_input->>'description',''),coalesce(nullif(p_input->>'product_type',''),'furnishing'),category_group,category_id,
    nullif(p_input->>'brand',''),nullif(p_input->>'color',''),nullif(p_input->>'finish',''),
    'draft','platform',
    coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_input->'tags','[]'::jsonb)) as value),'{}'),
    actor,actor,'link_import',coalesce(p_input->'extracted_snapshot','{}'::jsonb)
  ) returning * into product;

  insert into public.furnishing_product_room_compatibility(product_id,room_type_id)
    select product.id,room_id from unnest(room_ids) as room_id
    on conflict do nothing;

  if p_input ? 'style_tag_ids' then
    insert into public.furnishing_product_style_tags(product_id,style_tag_id)
      select product.id,(value)::uuid from jsonb_array_elements_text(p_input->'style_tag_ids') as value
      on conflict do nothing;
  end if;

  insert into public.furnishing_product_offers(
    product_id,retailer_id,retailer_product_id,sku,product_url,original_url,
    listed_price_minor,currency,availability,notes,last_verified_at,status,
    source_type,extraction_source,extraction_confidence
  ) values(
    product.id,nullif(p_input->>'retailer_id','')::uuid,nullif(p_input->>'retailer_product_id',''),nullif(p_input->>'sku',''),
    canonical_url,case when submitted_url is not null and submitted_url<>canonical_url then submitted_url else null end,
    nullif(p_input->>'listed_price_minor','')::bigint,coalesce(nullif(p_input->>'currency',''),'USD'),
    coalesce(nullif(p_input->>'availability',''),'unknown'),nullif(p_input->>'notes',''),now(),'active',
    'link_import',nullif(p_input->>'extraction_source',''),nullif(p_input->>'extraction_confidence','')
  ) returning id into offer_id;

  perform public.claim_furnishing_product_identity(product.id,null,to_jsonb(product));

  insert into public.furnishing_catalog_activity(product_id,offer_id,event_type,actor_id,metadata)
  values(product.id,offer_id,'furnishing_library_product_created',actor,
    jsonb_build_object('correlationId',correlation,'idempotencyKey',command_key,'extractionSource',p_input->>'extraction_source',
      'submittedUrl',submitted_url,'canonicalUrl',canonical_url,'externalEffects',false));

  return jsonb_build_object('status','created','productId',product.id,'offerId',offer_id,'revision',product.revision);
end $$;

create or replace function public.archive_furnishing_library_product(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); target uuid; expected bigint; correlation uuid; command_key text; why text; product public.furnishing_products%rowtype; event_id uuid; replayed record;
begin
  if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501'; end if;
  begin target:=(p_input->>'product_id')::uuid; expected:=(p_input->>'expected_revision')::bigint; correlation:=(p_input->>'correlation_id')::uuid; exception when others then raise exception 'CATALOG_LIBRARY_ARCHIVE_COMMAND_INVALID'; end;
  command_key:=left(trim(p_input->>'idempotency_key'),200); why:=nullif(trim(p_input->>'reason'),'');
  if length(command_key)<8 then raise exception 'CATALOG_LIBRARY_ARCHIVE_COMMAND_INVALID'; end if;
  select product_id into replayed from public.furnishing_catalog_activity where event_type='furnishing_library_product_archived' and metadata->>'idempotencyKey'=command_key limit 1;
  if found then return jsonb_build_object('status','replayed','productId',replayed.product_id); end if;
  select * into product from public.furnishing_products where id=target and scope='platform' and workspace_id is null for update;
  if not found then raise exception 'CATALOG_LIBRARY_ARCHIVE_TARGET_SCOPE_INVALID'; end if;
  if product.revision<>expected then raise exception 'CATALOG_PRODUCT_VERSION_STALE'; end if;
  if product.status='archived' then return jsonb_build_object('status','archived','productId',product.id,'revision',product.revision); end if;
  update public.furnishing_products set status='archived',revision=revision+1,updated_by=actor,updated_at=now(),
    retired_at=coalesce(retired_at,now()),retired_by=actor,retirement_reason=why where id=target returning * into product;
  insert into public.furnishing_catalog_activity(product_id,event_type,actor_id,metadata)
    values(target,'furnishing_library_product_archived',actor,jsonb_build_object('revision',product.revision,'correlationId',correlation,'idempotencyKey',command_key,'reason',why,'externalEffects',false))
    returning id into event_id;
  return jsonb_build_object('status','archived','productId',product.id,'revision',product.revision,'eventId',event_id);
end $$;

-- 4. Lightweight style-tag taxonomy ---------------------------------------

create table public.furnishing_style_tags(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null,
  status text not null default 'active' check(status in('active','retired')),
  sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.furnishing_product_style_tags(
  product_id uuid not null references public.furnishing_products(id) on delete cascade,
  style_tag_id uuid not null references public.furnishing_style_tags(id),
  primary key(product_id,style_tag_id)
);
create index furnishing_product_style_tags_tag_idx on public.furnishing_product_style_tags(style_tag_id,product_id);

insert into public.furnishing_style_tags(slug,name,sort_order) values
('warm-modern','Warm Modern',10),('modern','Modern',20),('contemporary','Contemporary',30),
('transitional','Transitional',40),('organic-modern','Organic Modern',50),('mid-century-modern','Mid-Century Modern',60),
('scandinavian','Scandinavian',70),('coastal','Coastal',80),('bohemian','Bohemian',90),
('industrial','Industrial',100),('traditional','Traditional',110),('rustic','Rustic',120),('luxury','Luxury',130)
on conflict(slug) do update set name=excluded.name,sort_order=excluded.sort_order;

do $$
begin
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
end $$;

alter table public.furnishing_style_tags enable row level security;
alter table public.furnishing_product_style_tags enable row level security;
create policy "Style tags are readable internally" on public.furnishing_style_tags for select to authenticated using(true);
create policy "Members read product style tags" on public.furnishing_product_style_tags for select to authenticated
  using(exists(select 1 from public.furnishing_products p where p.id=product_id and(p.scope='platform' or public.active_workspace_role(p.workspace_id) is not null or public.is_admin())));

-- 5. RLS: identity claims must also cover platform (nullable workspace) rows

drop policy if exists "Internal cohort reads product identity claims" on public.furnishing_product_identity_claims;
create policy "Internal cohort reads product identity claims" on public.furnishing_product_identity_claims for select to authenticated
  using((workspace_id is null and public.is_admin()) or (workspace_id is not null and public.fs008g_internal_catalog_visible(workspace_id)));

-- 6. Grants -----------------------------------------------------------

revoke all on function public.canonical_furnishing_product_identity(text,uuid,text,text,text,uuid,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.claim_furnishing_product_identity(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.create_furnishing_library_product(jsonb),public.archive_furnishing_library_product(jsonb) from public,anon;
grant execute on function public.create_furnishing_library_product(jsonb),public.archive_furnishing_library_product(jsonb) to authenticated;

commit;
