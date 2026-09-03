-- FS-UX-010 follow-up: persist the extracted primary image for add-by-link
-- products. The client already extracts an image URL from JSON-LD/Open
-- Graph; this closes the gap where it was captured but never stored.
begin;

create or replace function public.create_furnishing_library_product(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  actor uuid:=auth.uid(); correlation uuid; command_key text; submitted_url text; canonical_url text;
  name text; category_id uuid; category_group text; room_ids text[]; force_create boolean; image_url text;
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
  image_url:=nullif(trim(p_input->>'image_url'),'');
  if length(command_key)<8 or canonical_url is null or name is null or category_id is null or array_length(room_ids,1) is null then
    raise exception 'CATALOG_LIBRARY_CREATE_COMMAND_INVALID';
  end if;
  if image_url is not null and not (image_url ~* '^https://') then image_url:=null; end if;

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

  if image_url is not null then
    insert into public.furnishing_product_media(product_id,source_url,alt_text,media_kind,is_primary,sort_order,created_by)
    values(product.id,image_url,name,'product',true,0,actor);
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

revoke all on function public.create_furnishing_library_product(jsonb) from public,anon;
grant execute on function public.create_furnishing_library_product(jsonb) to authenticated;

commit;
