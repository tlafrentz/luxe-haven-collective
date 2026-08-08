-- FS-004: versioned physical-space design systems and property design direction.
begin;
create table public.furnishing_style_systems(
 id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id), name text not null, slug text not null,
 description text, scope text not null default 'platform' check(scope in('platform','workspace')), lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','in_review','approved','deprecated','archived')),
 current_version_id uuid, cover_media_asset_id uuid, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,slug)
);
create table public.furnishing_style_system_versions(
 id uuid primary key default gen_random_uuid(), style_system_id uuid not null references public.furnishing_style_systems(id) on delete cascade, version_number integer not null check(version_number>0),
 lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','in_review','approved','superseded','archived')), design_principles text[] not null default '{}', aesthetic_tags text[] not null default '{}', mood_tags text[] not null default '{}', contextual_tags text[] not null default '{}', positioning_tags text[] not null default '{}',
 created_by uuid not null references public.profiles(id), approved_by uuid references public.profiles(id), created_at timestamptz not null default now(), approved_at timestamptz, unique(style_system_id,version_number)
);
alter table public.furnishing_style_systems add constraint furnishing_style_systems_current_version_fkey foreign key(current_version_id) references public.furnishing_style_system_versions(id) on delete set null;
create table public.furnishing_design_tokens(
 id uuid primary key default gen_random_uuid(), style_system_version_id uuid not null references public.furnishing_style_system_versions(id) on delete cascade,
 token_type text not null check(token_type in('color','material','finish','texture','pattern','shape','scale','lighting','metal','wood_tone','upholstery','accent')), name text not null, value text, description text, media_asset_id uuid,
 priority text not null default 'primary' check(priority in('primary','secondary','accent')), sort_order integer not null default 0 check(sort_order>=0), unique(style_system_version_id,token_type,name)
);
create table public.furnishing_product_style_assignments(
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.furnishing_products(id) on delete cascade, style_system_version_id uuid not null references public.furnishing_style_system_versions(id) on delete cascade,
 compatibility text not null check(compatibility in('preferred','compatible','neutral','avoid')), rationale text, matched_token_ids uuid[] not null default '{}', provenance text not null default 'curated' check(provenance in('curated','imported','automated')),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(product_id,style_system_version_id)
);
create table public.furnishing_design_profiles(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), property_id uuid references public.properties(id), project_id uuid references public.furnishing_projects(id), name text not null,
 style_system_version_id uuid not null references public.furnishing_style_system_versions(id), status text not null default 'draft' check(status in('draft','approved','superseded')), current_version_id uuid,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(property_id is not null or project_id is not null)
);
create table public.furnishing_design_profile_versions(
 id uuid primary key default gen_random_uuid(), design_profile_id uuid not null references public.furnishing_design_profiles(id) on delete cascade, version_number integer not null check(version_number>0), style_system_version_id uuid not null references public.furnishing_style_system_versions(id),
 status text not null default 'draft' check(status in('draft','approved','superseded')), positioning_tier text not null check(positioning_tier in('essential','elevated','luxury','custom')), mood_tags text[] not null default '{}', contextual_tags text[] not null default '{}', selected_token_ids uuid[] not null default '{}', notes text,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), approved_at timestamptz, unique(design_profile_id,version_number)
);
alter table public.furnishing_design_profiles add constraint furnishing_design_profiles_current_version_fkey foreign key(current_version_id) references public.furnishing_design_profile_versions(id) on delete set null;
create table public.furnishing_room_design_directions(
 id uuid primary key default gen_random_uuid(), design_profile_version_id uuid not null references public.furnishing_design_profile_versions(id) on delete cascade, room_id uuid not null references public.furnishing_rooms(id),
 mood_tags text[] not null default '{}', contextual_tags text[] not null default '{}', accent_token_ids uuid[] not null default '{}', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(design_profile_version_id,room_id)
);
create table public.furnishing_mood_boards(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), project_id uuid references public.furnishing_projects(id), room_id uuid references public.furnishing_rooms(id), design_profile_version_id uuid not null references public.furnishing_design_profile_versions(id),
 name text not null, status text not null default 'draft' check(status in('draft','approved','archived')), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.furnishing_mood_board_items(
 id uuid primary key default gen_random_uuid(), mood_board_id uuid not null references public.furnishing_mood_boards(id) on delete cascade, item_type text not null check(item_type in('media','product','design_token','text')),
 media_asset_id uuid, product_id uuid references public.furnishing_products(id), design_token_id uuid references public.furnishing_design_tokens(id), text text, sort_order integer not null default 0 check(sort_order>=0), created_at timestamptz not null default now(),
 check(num_nonnulls(media_asset_id,product_id,design_token_id,text)=1)
);
create table public.furnishing_design_exceptions(
 id uuid primary key default gen_random_uuid(), design_profile_version_id uuid not null references public.furnishing_design_profile_versions(id) on delete cascade, room_id uuid references public.furnishing_rooms(id), product_id uuid not null references public.furnishing_products(id),
 reason text not null check(reason in('customer_preference','budget','availability','existing_inventory','intentional_contrast','other')), notes text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index furnishing_style_assignment_style_idx on public.furnishing_product_style_assignments(style_system_version_id,compatibility);
create index furnishing_design_profile_workspace_idx on public.furnishing_design_profiles(workspace_id,status);
alter table public.furnishing_style_systems enable row level security; alter table public.furnishing_style_system_versions enable row level security; alter table public.furnishing_design_tokens enable row level security; alter table public.furnishing_product_style_assignments enable row level security; alter table public.furnishing_design_profiles enable row level security; alter table public.furnishing_design_profile_versions enable row level security; alter table public.furnishing_room_design_directions enable row level security; alter table public.furnishing_mood_boards enable row level security; alter table public.furnishing_mood_board_items enable row level security; alter table public.furnishing_design_exceptions enable row level security;
create policy "Members read style systems" on public.furnishing_style_systems for select to authenticated using(scope='platform' or public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members read style versions" on public.furnishing_style_system_versions for select to authenticated using(exists(select 1 from public.furnishing_style_systems s where s.id=style_system_id and (s.scope='platform' or public.active_workspace_role(s.workspace_id)is not null or public.is_admin())));
create policy "Members read design tokens" on public.furnishing_design_tokens for select to authenticated using(exists(select 1 from public.furnishing_style_system_versions v join public.furnishing_style_systems s on s.id=v.style_system_id where v.id=style_system_version_id and (s.scope='platform' or public.active_workspace_role(s.workspace_id)is not null or public.is_admin())));
create policy "Members read product style assignments" on public.furnishing_product_style_assignments for select to authenticated using(exists(select 1 from public.furnishing_style_system_versions v join public.furnishing_style_systems s on s.id=v.style_system_id where v.id=style_system_version_id and (s.scope='platform' or public.active_workspace_role(s.workspace_id)is not null or public.is_admin())));
create policy "Members read design profiles" on public.furnishing_design_profiles for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members read design profile versions" on public.furnishing_design_profile_versions for select to authenticated using(exists(select 1 from public.furnishing_design_profiles p where p.id=design_profile_id and (public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Members read room directions" on public.furnishing_room_design_directions for select to authenticated using(exists(select 1 from public.furnishing_design_profile_versions v join public.furnishing_design_profiles p on p.id=v.design_profile_id where v.id=design_profile_version_id and (public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
create policy "Members read mood boards" on public.furnishing_mood_boards for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members read mood board items" on public.furnishing_mood_board_items for select to authenticated using(exists(select 1 from public.furnishing_mood_boards b where b.id=mood_board_id and (public.active_workspace_role(b.workspace_id)is not null or public.is_admin())));
create policy "Members read design exceptions" on public.furnishing_design_exceptions for select to authenticated using(exists(select 1 from public.furnishing_design_profile_versions v join public.furnishing_design_profiles p on p.id=v.design_profile_id where v.id=design_profile_version_id and (public.active_workspace_role(p.workspace_id)is not null or public.is_admin())));
commit;
