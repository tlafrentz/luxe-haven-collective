-- FS-008E: snapshot-native procurement source, preserving FS-006 plan compatibility.
alter table public.furnishing_procurement_baselines add column if not exists source_kind text not null default 'furnishing_plan';
alter table public.furnishing_procurement_baselines add column if not exists source_catalog_snapshot_id uuid references public.fs008d_project_catalog_snapshots(id);
alter table public.furnishing_procurement_baselines alter column source_plan_id drop not null;
alter table public.furnishing_procurement_baselines add constraint furnishing_procurement_baseline_source_check check ((source_kind='furnishing_plan' and source_plan_id is not null and source_catalog_snapshot_id is null) or (source_kind='catalog_snapshot' and source_plan_id is null and source_catalog_snapshot_id is not null));
create unique index if not exists furnishing_procurement_snapshot_unique on public.furnishing_procurement_baselines(source_catalog_snapshot_id) where source_catalog_snapshot_id is not null;
alter table public.furnishing_procurement_lines add column if not exists source_line_kind text not null default 'plan_selection';
alter table public.furnishing_procurement_lines add column if not exists source_snapshot_item_id uuid;
alter table public.furnishing_procurement_lines alter column source_plan_line_id drop not null;
alter table public.furnishing_procurement_lines add constraint furnishing_procurement_line_source_check check ((source_line_kind='plan_selection' and source_plan_line_id is not null and source_snapshot_item_id is null) or (source_line_kind='snapshot_item' and source_plan_line_id is null and source_snapshot_item_id is not null));
create table if not exists public.fs008d_snapshot_items(
 id uuid primary key default gen_random_uuid(), snapshot_id uuid not null references public.fs008d_project_catalog_snapshots(id) on delete restrict,
 stable_item_id text not null, product_id uuid references public.furnishing_products(id), retailer_offer_id uuid references public.furnishing_product_offers(id), room_id uuid, quantity numeric(12,4) not null check(quantity>0), observed_price_minor bigint, delivery_minor bigint not null default 0, selection_state text not null, content_hash text not null, created_at timestamptz not null default now(), unique(snapshot_id,stable_item_id)
);
alter table public.fs008d_snapshot_items enable row level security;
create policy "Owners read own snapshot items" on public.fs008d_snapshot_items for select to authenticated using(exists(select 1 from public.fs008d_project_catalog_snapshots s where s.id=snapshot_id and (public.is_admin() or s.tenant_id in(select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active'))));
revoke insert,update,delete on public.fs008d_snapshot_items from anon,authenticated;

create or replace function public.create_or_replay_snapshot_procurement_baseline(p_snapshot_id uuid,p_idempotency_key text,p_correlation_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s record; p record; b record; item jsonb; line record; begin
 if auth.uid() is null or not public.is_admin() then raise exception 'UNAUTHORIZED'; end if;
 select * into s from public.fs008d_project_catalog_snapshots where id=p_snapshot_id for update;
 if not found then raise exception 'SNAPSHOT_NOT_FOUND'; end if;
 select * into b from public.furnishing_procurement_baselines where source_catalog_snapshot_id=s.id for update;
 if found then return jsonb_build_object('status','replayed','id',b.id); end if;
 select * into p from public.furnishing_projects where id=s.project_id for update;
 if not found or coalesce(s.snapshot->>'offerCode','FS-DESIGN')<>'FS-DESIGN' then raise exception 'PROJECT_UNAVAILABLE'; end if;
 insert into public.furnishing_procurement_baselines(workspace_id,property_id,project_id,source_kind,source_catalog_snapshot_id,source_plan_version,source_snapshot,source_hash,currency,status,estimated_total_minor,idempotency_key,created_by) values(p.workspace_id,p.property_id,p.id,'catalog_snapshot',s.id,1,s.snapshot,s.content_hash,'USD','draft',0,p_idempotency_key,auth.uid()) returning * into b;
 for item in select value from jsonb_array_elements(coalesce(s.snapshot->'items','[]'::jsonb)) loop
   insert into public.fs008d_snapshot_items(snapshot_id,stable_item_id,quantity,observed_price_minor,selection_state,content_hash) values(s.id,coalesce(item->>'id',gen_random_uuid()::text),coalesce((item->>'quantity')::numeric,1),(item->>'priceMinor')::bigint,coalesce(item->>'state','selected'),md5(item::text)) on conflict do nothing returning * into line;
   insert into public.furnishing_procurement_lines(baseline_id,source_line_kind,source_snapshot_item_id,room_id,category,description,planned_quantity,existing_inventory_quantity,unit_of_measure,estimated_unit_cost_minor,estimated_line_cost_minor,currency,status,source_snapshot) values(b.id,'snapshot_item',line.id,coalesce((item->>'roomId')::uuid,p.property_id),'furnishing',coalesce(item->>'description','Snapshot item'),line.quantity,0,'each',line.observed_price_minor,line.observed_price_minor*line.quantity,'USD','planned',item);
 end loop;
 return jsonb_build_object('status','created','id',b.id);
end $$;
revoke all on function public.create_or_replay_snapshot_procurement_baseline(uuid,text,text) from public,anon;
grant execute on function public.create_or_replay_snapshot_procurement_baseline(uuid,text,text) to authenticated;
