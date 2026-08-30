-- FS-UX-002: governed platform-to-workspace catalog adoption and review lifecycle.
-- No capability state, external provider, procurement, payment, notification, or installation effects.
begin;

alter table public.furnishing_products
  add column if not exists revision bigint not null default 1,
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by uuid references public.profiles(id),
  add column if not exists retirement_reason text,
  add column if not exists replacement_product_id uuid references public.furnishing_products(id);

create table public.furnishing_product_adoptions(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id),
  source_product_id uuid not null references public.furnishing_products(id),
  workspace_product_id uuid not null unique references public.furnishing_products(id),
  source_revision bigint not null,
  source_digest text not null,
  adopted_fields jsonb not null,
  workspace_overrides jsonb not null default '{}',
  idempotency_key text not null unique,
  correlation_id uuid not null,
  adopted_by uuid not null references public.profiles(id),
  adopted_at timestamptz not null default now(),
  unique(workspace_id,source_product_id)
);

create table public.furnishing_product_review_events(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.owners(id),
  product_id uuid not null references public.furnishing_products(id),
  product_revision bigint not null,
  event_type text not null check(event_type in('submitted','changes_requested','approved','retired','replacement_assigned')),
  reason text,
  product_snapshot jsonb not null,
  correlation_id uuid not null,
  idempotency_key text not null unique,
  actor_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null default now()
);

create table public.furnishing_product_versions(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.furnishing_products(id),
  workspace_id uuid references public.owners(id),
  version bigint not null,
  lifecycle_status text not null check(lifecycle_status in('draft','approved','proposed','superseded','rejected')),
  product_snapshot jsonb not null,
  base_version bigint,
  change_reason text,
  correlation_id uuid not null,
  idempotency_key text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  unique(product_id,version)
);

create table public.furnishing_product_identity_claims(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id),
  product_id uuid not null references public.furnishing_products(id),
  identity_kind text not null check(identity_kind in('platform_source','normalized_product','retailer_sku')),
  identity_key text not null,
  lifecycle_status text not null,
  claimed_at timestamptz not null default now(),
  retired_at timestamptz,
  unique(workspace_id,identity_kind,identity_key),
  unique(product_id,identity_kind,identity_key)
);

create or replace function public.canonical_furnishing_product_identity(
  p_kind text,p_source_product_id uuid,p_name text,p_brand text,p_manufacturer_part_number text,
  p_retailer_id uuid,p_sku text,p_variant jsonb
) returns text language sql immutable set search_path=public,extensions,pg_temp as $$
 select encode(digest(concat_ws('|','fs-product-identity-v1',p_kind,
   coalesce(p_source_product_id::text,'<null>'),lower(regexp_replace(trim(coalesce(p_name,'')),'\s+',' ','g')),
   lower(regexp_replace(trim(coalesce(p_brand,'')),'\s+',' ','g')),
   lower(regexp_replace(trim(coalesce(p_manufacturer_part_number,'')),'\s+',' ','g')),
   coalesce(p_retailer_id::text,'<null>'),lower(regexp_replace(trim(coalesce(p_sku,'')),'\s+',' ','g')),
   coalesce(p_variant,'{}'::jsonb)::text),'sha256'),'hex')
$$;

create or replace function public.claim_furnishing_workspace_product_identity(
  p_product_id uuid,p_source_product_id uuid default null,p_snapshot jsonb default null
) returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare p public.furnishing_products%rowtype; o record; snap jsonb; variant jsonb; identity text; conflict record;
begin
 select * into p from public.furnishing_products where id=p_product_id and scope='workspace' and workspace_id is not null for update;
 if not found then raise exception 'CATALOG_IDENTITY_TARGET_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('furnishing-product-identity:'||p.workspace_id::text,0));
 snap:=coalesce(p_snapshot,to_jsonb(p));
 variant:=jsonb_strip_nulls(jsonb_build_object('color',snap->'color','material',snap->'material','finish',snap->'finish','dimensions',snap->'dimensions'));
 delete from public.furnishing_product_identity_claims where product_id=p.id and identity_kind in('normalized_product','retailer_sku');
 identity:=public.canonical_furnishing_product_identity('normalized_product',null,snap->>'name',snap->>'brand',snap->>'manufacturer_part_number',null,null,variant);
 select c.*,x.status as product_status into conflict from public.furnishing_product_identity_claims c join public.furnishing_products x on x.id=c.product_id where c.workspace_id=p.workspace_id and c.identity_kind='normalized_product' and c.identity_key=identity and c.product_id<>p.id;
 if found then
   if conflict.retired_at is not null or conflict.product_status in('discontinued','archived') then raise exception 'CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT'; end if;
   raise exception 'CATALOG_WORKSPACE_IDENTITY_CONFLICT';
 end if;
 insert into public.furnishing_product_identity_claims(workspace_id,product_id,identity_kind,identity_key,lifecycle_status)
 values(p.workspace_id,p.id,'normalized_product',identity,p.status)
 on conflict(product_id,identity_kind,identity_key) do update set lifecycle_status=excluded.lifecycle_status;
 if p_source_product_id is not null then
   identity:=public.canonical_furnishing_product_identity('platform_source',p_source_product_id,null,null,null,null,null,'{}');
   select c.*,x.status as product_status into conflict from public.furnishing_product_identity_claims c join public.furnishing_products x on x.id=c.product_id where c.workspace_id=p.workspace_id and c.identity_kind='platform_source' and c.identity_key=identity and c.product_id<>p.id;
   if found then
     if conflict.retired_at is not null or conflict.product_status in('discontinued','archived') then raise exception 'CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT'; end if;
     raise exception 'CATALOG_PLATFORM_SOURCE_ALREADY_ADOPTED';
   end if;
   insert into public.furnishing_product_identity_claims(workspace_id,product_id,identity_kind,identity_key,lifecycle_status)
   values(p.workspace_id,p.id,'platform_source',identity,p.status)
   on conflict(product_id,identity_kind,identity_key) do update set lifecycle_status=excluded.lifecycle_status;
 end if;
 for o in select retailer_id,sku from public.furnishing_product_offers where product_id=p.id and status<>'archived' loop
   identity:=public.canonical_furnishing_product_identity('retailer_sku',null,null,null,null,o.retailer_id,o.sku,variant);
   select c.*,x.status as product_status into conflict from public.furnishing_product_identity_claims c join public.furnishing_products x on x.id=c.product_id where c.workspace_id=p.workspace_id and c.identity_kind='retailer_sku' and c.identity_key=identity and c.product_id<>p.id;
   if found then
     if conflict.retired_at is not null or conflict.product_status in('discontinued','archived') then raise exception 'CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT'; end if;
     raise exception 'CATALOG_RETAILER_SKU_IDENTITY_CONFLICT';
   end if;
   insert into public.furnishing_product_identity_claims(workspace_id,product_id,identity_kind,identity_key,lifecycle_status)
   values(p.workspace_id,p.id,'retailer_sku',identity,p.status)
   on conflict(product_id,identity_kind,identity_key) do update set lifecycle_status=excluded.lifecycle_status;
 end loop;
end $$;

create or replace function public.enforce_furnishing_workspace_product_identity()
returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
 if new.scope<>'workspace' or new.workspace_id is null then return new; end if;
 if new.status in('discontinued','archived') then
   update public.furnishing_product_identity_claims set lifecycle_status=new.status,retired_at=coalesce(retired_at,now()) where product_id=new.id;
 else
   perform public.claim_furnishing_workspace_product_identity(new.id,new.family_product_id,to_jsonb(new));
 end if;
 return new;
end $$;
create trigger furnishing_workspace_product_identity_enforced
after insert or update of workspace_id,scope,status,name,brand,manufacturer_part_number,color,material,finish,dimensions,family_product_id
on public.furnishing_products for each row execute function public.enforce_furnishing_workspace_product_identity();

create or replace function public.enforce_furnishing_workspace_offer_identity()
returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare target uuid; p public.furnishing_products%rowtype;
begin
 target:=case when tg_op='DELETE' then old.product_id else new.product_id end;
 select * into p from public.furnishing_products where id=target;
 if found and p.scope='workspace' and p.workspace_id is not null then perform public.claim_furnishing_workspace_product_identity(p.id,p.family_product_id,to_jsonb(p)); end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger furnishing_workspace_offer_identity_insert_delete
after insert or delete on public.furnishing_product_offers
for each row execute function public.enforce_furnishing_workspace_offer_identity();
create trigger furnishing_workspace_offer_identity_update
after update of product_id,retailer_id,sku,status on public.furnishing_product_offers
for each row execute function public.enforce_furnishing_workspace_offer_identity();

do $$ declare p record; begin
 for p in select id,family_product_id from public.furnishing_products where scope='workspace' and workspace_id is not null loop
   perform public.claim_furnishing_workspace_product_identity(p.id,p.family_product_id,null);
 end loop;
exception when unique_violation then raise exception 'FSUX002_DUPLICATE_ACTIVE_WORKSPACE_IDENTITY_REVIEW_REQUIRED';
end $$;

create index furnishing_product_adoptions_source_idx on public.furnishing_product_adoptions(source_product_id,workspace_id);
create index furnishing_product_review_queue_idx on public.furnishing_product_review_events(workspace_id,event_type,occurred_at desc);
create index furnishing_product_versions_history_idx on public.furnishing_product_versions(product_id,version desc);

create or replace function public.edit_furnishing_product(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare actor uuid:=auth.uid();target uuid;workspace uuid;expected bigint;correlation uuid;command_key text;why text;changes jsonb;product public.furnishing_products%rowtype;next_snapshot jsonb;prior public.furnishing_product_versions%rowtype;next_version bigint;
begin
 if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';end if;
 begin target:=(p_input->>'product_id')::uuid;expected:=(p_input->>'expected_revision')::bigint;correlation:=(p_input->>'correlation_id')::uuid;workspace:=nullif(p_input->>'workspace_id','')::uuid;exception when others then raise exception 'CATALOG_EDIT_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);why:=nullif(trim(p_input->>'reason'),'');changes:=coalesce(p_input->'changes','{}'::jsonb);
 if length(command_key)<8 or jsonb_typeof(changes)<>'object' or changes-'name'-'description'-'brand'-'category_id'-'color'-'material'-'finish'-'assembly_required'<>'{}'::jsonb then raise exception 'CATALOG_EDIT_COMMAND_INVALID';end if;
 select * into prior from public.furnishing_product_versions where idempotency_key=command_key;
 if found then return jsonb_build_object('status','replayed','productId',prior.product_id,'version',prior.version,'proposalId',prior.id);end if;
 select * into product from public.furnishing_products where id=target for update;
 if not found or (product.scope='workspace' and product.workspace_id is distinct from workspace) or (product.scope='platform' and workspace is not null) then raise exception 'CATALOG_EDIT_TARGET_SCOPE_INVALID';end if;
 if product.scope='workspace' then perform public.authorize_controlled_furnishing_catalog_mutation(workspace);end if;
 if product.revision<>expected then raise exception 'CATALOG_PRODUCT_VERSION_STALE';end if;
 if product.status not in('draft','approved') then raise exception 'CATALOG_PRODUCT_NOT_EDITABLE';end if;
 if nullif(trim(changes->>'name'),'') is null then raise exception 'CATALOG_PRODUCT_NAME_REQUIRED';end if;
 next_snapshot:=to_jsonb(product)||jsonb_build_object('name',trim(changes->>'name'),'description',changes->'description','brand',changes->'brand','category_id',changes->'category_id','color',changes->'color','material',changes->'material','finish',changes->'finish','assembly_required',changes->'assembly_required');
 if product.status='draft' then
   if product.scope='workspace' then perform public.claim_furnishing_workspace_product_identity(product.id,product.family_product_id,next_snapshot); end if;
   update public.furnishing_products set name=next_snapshot->>'name',description=next_snapshot->>'description',brand=next_snapshot->>'brand',category_id=nullif(next_snapshot->>'category_id','')::uuid,color=next_snapshot->>'color',material=next_snapshot->>'material',finish=next_snapshot->>'finish',assembly_required=case when next_snapshot ? 'assembly_required' then (next_snapshot->>'assembly_required')::boolean else assembly_required end,revision=revision+1,updated_by=actor,updated_at=now() where id=product.id returning * into product;
   insert into public.furnishing_catalog_activity(workspace_id,product_id,event_type,actor_id,metadata) values(product.workspace_id,product.id,'catalog_product_draft_updated',actor,jsonb_build_object('revision',product.revision,'correlationId',correlation,'idempotencyKey',command_key,'externalEffects',false));
   insert into public.furnishing_product_versions(product_id,workspace_id,version,lifecycle_status,product_snapshot,base_version,change_reason,correlation_id,idempotency_key,created_by)
   values(product.id,product.workspace_id,product.revision,'draft',to_jsonb(product),expected,coalesce(why,'Draft edit'),correlation,command_key,actor);
   return jsonb_build_object('status','draft_updated','productId',product.id,'revision',product.revision);
 end if;
 if length(coalesce(why,''))<3 then raise exception 'CATALOG_REVISION_REASON_REQUIRED';end if;
 if exists(select 1 from public.furnishing_product_versions where product_id=product.id and lifecycle_status='proposed') then raise exception 'CATALOG_REVISION_ALREADY_OPEN';end if;
 insert into public.furnishing_product_versions(product_id,workspace_id,version,lifecycle_status,product_snapshot,base_version,change_reason,correlation_id,idempotency_key,created_by,approved_by,approved_at)
 values(product.id,product.workspace_id,product.revision,'approved',to_jsonb(product),null,'Historical approved state captured before proposal',correlation,command_key||':base',actor,product.updated_by,product.updated_at) on conflict(product_id,version) do nothing;
 next_version:=product.revision+1;
 insert into public.furnishing_product_versions(product_id,workspace_id,version,lifecycle_status,product_snapshot,base_version,change_reason,correlation_id,idempotency_key,created_by)
 values(product.id,product.workspace_id,next_version,'proposed',next_snapshot,product.revision,why,correlation,command_key,actor) returning * into prior;
 insert into public.furnishing_catalog_activity(workspace_id,product_id,event_type,actor_id,metadata) values(product.workspace_id,product.id,'catalog_product_update_proposed',actor,jsonb_build_object('baseRevision',product.revision,'proposedRevision',next_version,'proposalId',prior.id,'correlationId',correlation,'reason',why,'externalEffects',false));
 return jsonb_build_object('status','revision_proposed','productId',product.id,'version',next_version,'proposalId',prior.id);
end $$;

create or replace function public.approve_furnishing_product_revision(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();workspace uuid;target uuid;proposal_id uuid;correlation uuid;expected bigint;command_key text;why text;product public.furnishing_products%rowtype;proposal public.furnishing_product_versions%rowtype;prior public.furnishing_product_review_events%rowtype;
begin
 if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';end if;
 begin workspace:=nullif(p_input->>'workspace_id','')::uuid;target:=(p_input->>'product_id')::uuid;proposal_id:=(p_input->>'proposal_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;expected:=(p_input->>'expected_revision')::bigint;exception when others then raise exception 'CATALOG_REVISION_APPROVAL_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);why:=trim(p_input->>'reason');if length(command_key)<8 or length(why)<3 then raise exception 'CATALOG_REVISION_APPROVAL_INVALID';end if;
 if workspace is not null then perform public.authorize_controlled_furnishing_catalog_mutation(workspace);end if;
 select * into prior from public.furnishing_product_review_events where idempotency_key=command_key;if found then return jsonb_build_object('status','replayed','productId',prior.product_id,'revision',prior.product_revision);end if;
 select * into product from public.furnishing_products where id=target and ((workspace is not null and scope='workspace' and workspace_id=workspace) or (workspace is null and scope='platform' and workspace_id is null)) for update;if not found then raise exception 'CATALOG_REVISION_TARGET_SCOPE_INVALID';end if;
 if product.revision<>expected then raise exception 'CATALOG_PRODUCT_VERSION_STALE';end if;
 select * into proposal from public.furnishing_product_versions where id=proposal_id and product_id=target and workspace_id is not distinct from workspace and lifecycle_status='proposed' and base_version=expected for update;if not found then raise exception 'CATALOG_REVISION_NOT_REVIEWABLE';end if;
 if product.scope='workspace' then perform public.claim_furnishing_workspace_product_identity(product.id,product.family_product_id,proposal.product_snapshot); end if;
 update public.furnishing_product_versions set lifecycle_status='superseded' where product_id=target and lifecycle_status='approved';
 update public.furnishing_product_versions set lifecycle_status='approved',approved_by=actor,approved_at=now() where id=proposal.id;
 update public.furnishing_products set name=proposal.product_snapshot->>'name',description=proposal.product_snapshot->>'description',brand=proposal.product_snapshot->>'brand',category_id=nullif(proposal.product_snapshot->>'category_id','')::uuid,color=proposal.product_snapshot->>'color',material=proposal.product_snapshot->>'material',finish=proposal.product_snapshot->>'finish',assembly_required=case when proposal.product_snapshot ? 'assembly_required' then (proposal.product_snapshot->>'assembly_required')::boolean else assembly_required end,revision=proposal.version,status='approved',updated_by=actor,updated_at=now() where id=target returning * into product;
 insert into public.furnishing_product_review_events(workspace_id,product_id,product_revision,event_type,reason,product_snapshot,correlation_id,idempotency_key,actor_id) values(workspace,target,product.revision,'approved',why,to_jsonb(product),correlation,command_key,actor) returning * into prior;
 insert into public.furnishing_catalog_activity(workspace_id,product_id,event_type,actor_id,metadata) values(workspace,target,'catalog_product_revision_approved',actor,jsonb_build_object('revision',product.revision,'proposalId',proposal.id,'correlationId',correlation,'externalEffects',false));
 return jsonb_build_object('status','approved','productId',target,'revision',product.revision,'proposalId',proposal.id);
end $$;

create or replace function public.adopt_furnishing_platform_product(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare actor uuid:=auth.uid(); workspace uuid; source_id uuid; correlation uuid; command_key text; overrides jsonb;
 source public.furnishing_products%rowtype; destination public.furnishing_products%rowtype; adoption public.furnishing_product_adoptions%rowtype;
 snapshot jsonb; digest text; source_offer record; new_offer uuid;
begin
 if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';end if;
 begin workspace:=(p_input->>'workspace_id')::uuid;source_id:=(p_input->>'source_product_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'CATALOG_ADOPTION_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);overrides:=coalesce(p_input->'workspace_overrides','{}'::jsonb);
 if length(command_key)<8 or jsonb_typeof(overrides)<>'object' or overrides-'name'-'description'-'category_id'-'tags'-'style_tags'<>'{}'::jsonb then raise exception 'CATALOG_ADOPTION_COMMAND_INVALID';end if;
 perform public.authorize_controlled_furnishing_catalog_mutation(workspace);
 perform pg_advisory_xact_lock(hashtextextended('furnishing-product-identity:'||workspace::text,0));
 select * into adoption from public.furnishing_product_adoptions where idempotency_key=command_key;
 if found then
   if adoption.workspace_id<>workspace or adoption.source_product_id<>source_id then raise exception 'CATALOG_ADOPTION_REPLAY_CONFLICT';end if;
   return jsonb_build_object('status','replayed','workspaceProductId',adoption.workspace_product_id,'adoptionId',adoption.id);
 end if;
 select * into source from public.furnishing_products where id=source_id and scope='platform' and workspace_id is null for share;
 if not found or source.status='archived' then raise exception 'CATALOG_ADOPTION_SOURCE_INVALID';end if;
 select p.* into destination from public.furnishing_products p where p.workspace_id=workspace and p.scope='workspace' and p.family_product_id=source.id and p.status not in('discontinued','archived') limit 1;
 if found then return jsonb_build_object('status','existing','workspaceProductId',destination.id);end if;
 snapshot:=to_jsonb(source);digest:=encode(digest(snapshot::text,'sha256'),'hex');
 insert into public.furnishing_products(workspace_id,name,description,product_type,category,subcategory,brand,manufacturer_part_number,status,scope,tags,created_by,updated_by,category_id,color,material,finish,dimensions,weight,assembly_required,indoor_outdoor,hospitality_attributes,style_tags,durability_type,replenishment_type,purchase_unit,units_per_purchase,usable_unit,family_product_id,source_type,source_import_id,source_sheet,source_row,imported_at)
 values(workspace,coalesce(nullif(trim(overrides->>'name'),''),source.name),coalesce(overrides->>'description',source.description),source.product_type,source.category,source.subcategory,source.brand,source.manufacturer_part_number,'draft','workspace',case when overrides ? 'tags' then array(select jsonb_array_elements_text(overrides->'tags')) else source.tags end,actor,actor,coalesce((overrides->>'category_id')::uuid,source.category_id),source.color,source.material,source.finish,source.dimensions,source.weight,source.assembly_required,source.indoor_outdoor,source.hospitality_attributes,case when overrides ? 'style_tags' then array(select jsonb_array_elements_text(overrides->'style_tags')) else source.style_tags end,source.durability_type,source.replenishment_type,source.purchase_unit,source.units_per_purchase,source.usable_unit,source.id,'platform_adoption',source.source_import_id,source.source_sheet,source.source_row,source.imported_at) returning * into destination;
 insert into public.furnishing_product_room_compatibility(product_id,room_type_id) select destination.id,room_type_id from public.furnishing_product_room_compatibility where product_id=source.id on conflict do nothing;
 insert into public.furnishing_product_specifications(product_id,specification_key,value_text,value_number,unit) select destination.id,specification_key,value_text,value_number,unit from public.furnishing_product_specifications where product_id=source.id on conflict do nothing;
 for source_offer in select * from public.furnishing_product_offers where product_id=source.id and status<>'archived' loop
   insert into public.furnishing_product_offers(workspace_id,product_id,retailer_id,retailer_product_id,sku,product_url,listed_price_minor,shipping_price_minor,currency,availability,affiliate_url,last_verified_at,status,notes,source_type,source_import_id,source_sheet,source_row,imported_at)
   values(workspace,destination.id,source_offer.retailer_id,source_offer.retailer_product_id,source_offer.sku,source_offer.product_url,source_offer.listed_price_minor,source_offer.shipping_price_minor,source_offer.currency,source_offer.availability,source_offer.affiliate_url,source_offer.last_verified_at,source_offer.status,source_offer.notes,'platform_adoption',source_offer.source_import_id,source_offer.source_sheet,source_offer.source_row,source_offer.imported_at) returning id into new_offer;
 end loop;
 perform public.claim_furnishing_workspace_product_identity(destination.id,source.id,to_jsonb(destination));
 insert into public.furnishing_product_adoptions(workspace_id,source_product_id,workspace_product_id,source_revision,source_digest,adopted_fields,workspace_overrides,idempotency_key,correlation_id,adopted_by) values(workspace,source.id,destination.id,source.revision,digest,snapshot,overrides,command_key,correlation,actor) returning * into adoption;
 insert into public.furnishing_catalog_activity(workspace_id,product_id,event_type,actor_id,metadata) values(workspace,destination.id,'catalog_platform_product_adopted',actor,jsonb_build_object('sourceProductId',source.id,'sourceRevision',source.revision,'sourceDigest',digest,'adoptionId',adoption.id,'correlationId',correlation,'externalEffects',false));
 return jsonb_build_object('status','adopted','workspaceProductId',destination.id,'adoptionId',adoption.id,'sourceDigest',digest);
end $$;

create or replace function public.transition_furnishing_product_review(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();workspace uuid;target uuid;correlation uuid;expected bigint;operation text;reason text;command_key text;product public.furnishing_products%rowtype;event_id uuid;
begin
 if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';end if;
 begin workspace:=(p_input->>'workspace_id')::uuid;target:=(p_input->>'product_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;expected:=(p_input->>'expected_revision')::bigint;exception when others then raise exception 'CATALOG_REVIEW_COMMAND_INVALID';end;
 operation:=p_input->>'operation';reason:=nullif(trim(p_input->>'reason'),'');command_key:=left(trim(p_input->>'idempotency_key'),200);
 if operation not in('submit','changes_requested','retire') or length(command_key)<8 or (operation in('changes_requested','retire') and length(coalesce(reason,''))<3) then raise exception 'CATALOG_REVIEW_COMMAND_INVALID';end if;
 perform public.authorize_controlled_furnishing_catalog_mutation(workspace);
 if exists(select 1 from public.furnishing_product_review_events where idempotency_key=command_key) then return jsonb_build_object('status','replayed');end if;
 select * into product from public.furnishing_products where id=target and workspace_id=workspace and scope='workspace' for update;
 if not found then raise exception 'CATALOG_REVIEW_TARGET_SCOPE_INVALID';end if;
 if product.revision<>expected then raise exception 'CATALOG_PRODUCT_VERSION_STALE';end if;
 if operation='submit' and product.status<>'draft' then raise exception 'CATALOG_PRODUCT_NOT_SUBMITTABLE';end if;
 if operation='changes_requested' and product.status<>'in_review' then raise exception 'CATALOG_PRODUCT_NOT_REVIEWABLE';end if;
 if operation='retire' and product.status<>'approved' then raise exception 'CATALOG_PRODUCT_NOT_RETIRABLE';end if;
 update public.furnishing_products set status=case operation when 'submit' then 'in_review' when 'changes_requested' then 'draft' else 'discontinued' end,revision=revision+1,updated_by=actor,updated_at=now(),retired_at=case when operation='retire' then now() else retired_at end,retired_by=case when operation='retire' then actor else retired_by end,retirement_reason=case when operation='retire' then reason else retirement_reason end where id=target returning * into product;
 insert into public.furnishing_product_review_events(workspace_id,product_id,product_revision,event_type,reason,product_snapshot,correlation_id,idempotency_key,actor_id) values(workspace,target,product.revision,case operation when 'submit' then 'submitted' when 'changes_requested' then 'changes_requested' else 'retired' end,reason,to_jsonb(product),correlation,command_key,actor) returning id into event_id;
 insert into public.furnishing_catalog_activity(workspace_id,product_id,event_type,actor_id,metadata) values(workspace,target,'catalog_product_'||operation,actor,jsonb_build_object('revision',product.revision,'reviewEventId',event_id,'correlationId',correlation,'reason',reason,'externalEffects',false));
 return jsonb_build_object('status',product.status,'productId',product.id,'revision',product.revision,'eventId',event_id);
end $$;

-- Preserve the existing approval contract while requiring the review state and
-- advancing the authoritative product revision. Platform targets still fail.
create or replace function public.approve_controlled_furnishing_catalog_target(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare actor uuid:=auth.uid();workspace uuid;kind text;target uuid;decision text;why text;correlation uuid;command_key text;snapshot jsonb;hash text;prior public.furnishing_catalog_approvals%rowtype;
begin
 if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';end if;
 begin workspace:=(p_input->>'workspace_id')::uuid;target:=(p_input->>'target_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'CATALOG_APPROVAL_COMMAND_INVALID';end;
 kind:=p_input->>'target_type';decision:=p_input->>'status';why:=trim(p_input->>'reason');command_key:=left(trim(p_input->>'idempotency_key'),200);
 if kind not in('product','offer','requirement') or decision not in('approved','rejected','revoked') or length(why)<3 or length(command_key)<8 then raise exception 'CATALOG_APPROVAL_COMMAND_INVALID';end if;
 perform public.authorize_controlled_furnishing_catalog_mutation(workspace);
 select * into prior from public.furnishing_catalog_approvals where idempotency_key=command_key;
 if found then if prior.workspace_id<>workspace or prior.target_type<>kind or prior.target_id<>target or prior.status<>decision then raise exception 'CATALOG_APPROVAL_REPLAY_CONFLICT';end if;return jsonb_build_object('status','replayed','id',prior.id);end if;
 if kind='product' then select to_jsonb(p) into snapshot from public.furnishing_products p where p.id=target and p.workspace_id=workspace and p.scope='workspace' and (decision<>'approved' or p.status='in_review');
 elsif kind='offer' then select to_jsonb(o) into snapshot from public.furnishing_product_offers o join public.furnishing_products p on p.id=o.product_id where o.id=target and p.workspace_id=workspace and p.scope='workspace';
 else select to_jsonb(q) into snapshot from public.furnishing_room_requirements q where q.id=target and q.workspace_id=workspace and q.scope='workspace';end if;
 if snapshot is null then raise exception 'CATALOG_APPROVAL_TARGET_SCOPE_INVALID';end if;
 hash:=encode(digest(snapshot::text,'sha256'),'hex');
 insert into public.furnishing_catalog_approvals(workspace_id,target_type,target_id,status,target_snapshot,snapshot_hash,reason,correlation_id,idempotency_key,approved_by) values(workspace,kind,target,decision,snapshot,hash,why,correlation,command_key,actor) returning * into prior;
 if kind='product' then update public.furnishing_products set status=case when decision='approved' then 'approved' else 'in_review' end,revision=revision+1,updated_by=actor,updated_at=now() where id=target;
 elsif kind='offer' then update public.furnishing_product_offers set status=case when decision='approved' then 'active' else 'unavailable' end where id=target;end if;
 if kind='product' then insert into public.furnishing_product_review_events(workspace_id,product_id,product_revision,event_type,reason,product_snapshot,correlation_id,idempotency_key,actor_id) select workspace,target,revision,'approved',why,to_jsonb(p),correlation,command_key||':review',actor from public.furnishing_products p where p.id=target;end if;
 return jsonb_build_object('status',decision,'id',prior.id,'snapshotHash',hash);
end $$;

alter table public.furnishing_product_adoptions enable row level security;
alter table public.furnishing_product_review_events enable row level security;
alter table public.furnishing_product_versions enable row level security;
alter table public.furnishing_product_identity_claims enable row level security;
create policy "Internal cohort reads product adoptions" on public.furnishing_product_adoptions for select to authenticated using(public.fs008g_internal_catalog_visible(workspace_id));
create policy "Internal cohort reads product reviews" on public.furnishing_product_review_events for select to authenticated using(public.fs008g_internal_catalog_visible(workspace_id));
create policy "Internal cohort reads product versions" on public.furnishing_product_versions for select to authenticated using(workspace_id is not null and public.fs008g_internal_catalog_visible(workspace_id));
create policy "Internal cohort reads product identity claims" on public.furnishing_product_identity_claims for select to authenticated using(public.fs008g_internal_catalog_visible(workspace_id));
revoke all on public.furnishing_product_adoptions,public.furnishing_product_review_events,public.furnishing_product_versions,public.furnishing_product_identity_claims from public,anon;
revoke insert,update,delete on public.furnishing_product_adoptions,public.furnishing_product_review_events,public.furnishing_product_versions,public.furnishing_product_identity_claims from authenticated;
grant select on public.furnishing_product_adoptions,public.furnishing_product_review_events,public.furnishing_product_versions,public.furnishing_product_identity_claims to authenticated;
revoke all on function public.canonical_furnishing_product_identity(text,uuid,text,text,text,uuid,text,jsonb),public.claim_furnishing_workspace_product_identity(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.adopt_furnishing_platform_product(jsonb),public.transition_furnishing_product_review(jsonb),public.edit_furnishing_product(jsonb),public.approve_furnishing_product_revision(jsonb) from public,anon;
grant execute on function public.adopt_furnishing_platform_product(jsonb),public.transition_furnishing_product_review(jsonb),public.edit_furnishing_product(jsonb),public.approve_furnishing_product_revision(jsonb) to authenticated;
commit;
