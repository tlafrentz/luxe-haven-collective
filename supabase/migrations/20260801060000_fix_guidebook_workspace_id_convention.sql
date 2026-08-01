-- guidebooks, guidebook_publish_jobs, guidebook_guest_deliveries,
-- guidebook_command_receipts, guidebook_drafts, and guidebook_media_assets all
-- define workspace_id as a foreign key to profiles(id), left over from an
-- earlier auth.uid()-based access model. Every other table in the app (and the
-- RLS policies gb001 already rewrote for guidebooks/drafts/command_receipts/
-- media_assets themselves) treats workspace_id as the owner id from
-- public.owners. The stale FK made every guidebook write fail with a foreign
-- key violation, since the application always resolves and passes the owner id.
alter table public.guidebooks
  drop constraint guidebooks_workspace_id_fkey,
  add constraint guidebooks_workspace_id_fkey foreign key (workspace_id) references public.owners(id);

alter table public.guidebook_publish_jobs
  drop constraint guidebook_publish_jobs_workspace_id_fkey,
  add constraint guidebook_publish_jobs_workspace_id_fkey foreign key (workspace_id) references public.owners(id);

alter table public.guidebook_guest_deliveries
  drop constraint guidebook_guest_deliveries_workspace_id_fkey,
  add constraint guidebook_guest_deliveries_workspace_id_fkey foreign key (workspace_id) references public.owners(id);

alter table public.guidebook_command_receipts
  drop constraint guidebook_command_receipts_workspace_id_fkey,
  add constraint guidebook_command_receipts_workspace_id_fkey foreign key (workspace_id) references public.owners(id);

alter table public.guidebook_drafts
  drop constraint guidebook_drafts_workspace_id_fkey,
  add constraint guidebook_drafts_workspace_id_fkey foreign key (workspace_id) references public.owners(id);

alter table public.guidebook_media_assets
  drop constraint guidebook_media_assets_workspace_id_fkey,
  add constraint guidebook_media_assets_workspace_id_fkey foreign key (workspace_id) references public.owners(id);

-- gb001 already rewrote the RLS policies for guidebooks, guidebook_sections,
-- guidebook_blocks, guidebook_versions, guidebook_analytics,
-- guidebook_command_receipts, guidebook_drafts, and guidebook_media_assets to
-- check public.active_workspace_role(...) / public.can_access_workspace_property(...)
-- instead of workspace_id = auth.uid(). These five tables were missed.
drop policy if exists "Owners read guidebook activity" on public.guidebook_activity;
create policy "Members read scoped guidebook activity"
on public.guidebook_activity for select to authenticated using (
  exists (
    select 1 from public.guidebooks guidebook
    where guidebook.id = guidebook_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

drop policy if exists "Owners read guidebook recommendations" on public.guidebook_recommendations;
create policy "Members read scoped guidebook recommendations"
on public.guidebook_recommendations for select to authenticated using (
  exists (
    select 1 from public.guidebooks guidebook
    where guidebook.id = guidebook_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

drop policy if exists "Authorized users read guidebook publish jobs" on public.guidebook_publish_jobs;
create policy "Members read scoped guidebook publish jobs"
on public.guidebook_publish_jobs for select to authenticated using (
  exists (
    select 1 from public.guidebooks guidebook
    where guidebook.id = guidebook_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

drop policy if exists "Authorized users read guidebook restore history" on public.guidebook_restore_history;
create policy "Members read scoped guidebook restore history"
on public.guidebook_restore_history for select to authenticated using (
  exists (
    select 1 from public.guidebooks guidebook
    where guidebook.id = guidebook_id
      and (
        public.is_admin()
        or (
          public.active_workspace_role(guidebook.workspace_id) is not null
          and public.can_access_workspace_property(guidebook.property_id)
        )
      )
  )
);

drop policy if exists "Authorized users read guidebook guest deliveries" on public.guidebook_guest_deliveries;
create policy "Members read scoped guidebook guest deliveries"
on public.guidebook_guest_deliveries for select to authenticated using (
  public.is_admin()
  or (
    public.active_workspace_role(workspace_id) is not null
    and public.can_access_workspace_property((
      select guidebook.property_id from public.guidebooks guidebook
      where guidebook.id = guidebook_id
    ))
  )
);
