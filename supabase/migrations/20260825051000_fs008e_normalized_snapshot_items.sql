-- FS-008E: immutable normalized procurement items for newly-created snapshots.
alter table public.fs008d_snapshot_items add column if not exists tenant_id uuid references public.owners(id);
alter table public.fs008d_snapshot_items add column if not exists project_id uuid references public.furnishing_projects(id);
alter table public.fs008d_snapshot_items add column if not exists package_item_id uuid references public.furnishing_room_package_items(id);
alter table public.fs008d_snapshot_items add column if not exists extended_product_cost_minor bigint;
alter table public.fs008d_snapshot_items add column if not exists required boolean not null default true;
alter table public.fs008d_snapshot_items add column if not exists selection_state text not null default 'preferred';
alter table public.fs008d_snapshot_items add column if not exists existing_inventory_disposition text;
alter table public.fs008d_snapshot_items add column if not exists source_lineage jsonb not null default '{}';
alter table public.fs008d_snapshot_items add column if not exists currency text not null default 'USD';
alter table public.fs008d_snapshot_items add constraint fs008d_snapshot_items_room_required check(room_id is not null);
create or replace function public.prevent_fs008d_snapshot_item_mutation() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'FS008D_SNAPSHOT_ITEM_IMMUTABLE'; end $$;
drop trigger if exists fs008d_snapshot_item_immutable on public.fs008d_snapshot_items;
create trigger fs008d_snapshot_item_immutable before update or delete on public.fs008d_snapshot_items for each row execute function public.prevent_fs008d_snapshot_item_mutation();

create or replace function public.create_furnishing_project_catalog_snapshot(p_project_id uuid,p_package_version_id uuid,p_snapshot jsonb,p_content_hash text,p_correlation_id text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; s record; item jsonb; item_id uuid; room uuid; qty numeric; price bigint; begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 select * into p from public.furnishing_projects where id=p_project_id for update;
 if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
 if not public.is_admin() and not exists(select 1 from public.customer_account_memberships m where m.profile_id=auth.uid() and m.tenant_id=p.workspace_id and m.status='active') then raise exception 'UNAUTHORIZED'; end if;
 select * into s from public.fs008d_project_catalog_snapshots where project_id=p.id and package_version_id=p_package_version_id for update;
 if found then if s.content_hash<>p_content_hash then raise exception 'SNAPSHOT_REPLAY_CONFLICT'; end if; return jsonb_build_object('status','replayed','id',s.id,'content_hash',s.content_hash); end if;
 if not exists(select 1 from public.furnishing_package_versions v where v.id=p_package_version_id and v.lifecycle_status='approved') then raise exception 'PACKAGE_NOT_APPROVED'; end if;
 insert into public.fs008d_project_catalog_snapshots(project_id,tenant_id,package_version_id,snapshot,content_hash,correlation_id) values(p.id,p.workspace_id,p_package_version_id,p_snapshot,p_content_hash,left(p_correlation_id,120)) returning * into s;
 for item in select value from jsonb_array_elements(coalesce(p_snapshot->'items','[]'::jsonb)) loop
   room:=nullif(item->>'roomId','')::uuid; qty:=nullif(item->>'quantity','')::numeric; price:=nullif(item->>'priceMinor','')::bigint;
   if room is null or not exists(select 1 from public.furnishing_rooms r where r.id=room and r.project_id=p.id) then raise exception 'SNAPSHOT_ITEM_ROOM_INVALID'; end if;
   if qty is null or qty<=0 or price is null or price<0 then raise exception 'SNAPSHOT_ITEM_VALUE_INVALID'; end if;
   item_id:=gen_random_uuid();
   insert into public.fs008d_snapshot_items(id,snapshot_id,tenant_id,project_id,stable_item_id,room_id,package_item_id,product_id,retailer_offer_id,quantity,observed_price_minor,extended_product_cost_minor,delivery_minor,currency,required,selection_state,existing_inventory_disposition,source_lineage,content_hash)
   values(item_id,s.id,p.workspace_id,p.id,coalesce(item->>'id',item_id::text),room,nullif(item->>'packageItemId','')::uuid,nullif(item->>'productId','')::uuid,nullif(item->>'offerId','')::uuid,qty,price,price*qty,coalesce((item->>'deliveryMinor')::bigint,0),coalesce(item->>'currency','USD'),coalesce((item->>'required')::boolean,true),coalesce(item->>'selectionState','preferred'),item->>'existingInventoryDisposition',coalesce(item->'sourceLineage','{}'::jsonb),md5(item::text));
 end loop;
 return jsonb_build_object('status','created','id',s.id,'content_hash',s.content_hash);
exception when others then raise;
end $$;
