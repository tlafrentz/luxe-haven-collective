-- LHC-GS-002 Experience Component Library v1
alter table public.guidebook_library_artifacts add column if not exists replacement_artifact_id uuid references public.guidebook_library_artifacts(id) on delete restrict;
alter table public.guidebook_library_artifacts add column if not exists supported_channels text[] not null default array['responsive_web','mobile_web','pdf','guest_portal'];
alter table public.guidebook_library_artifacts add column if not exists definition_lifecycle text;
update public.guidebook_library_artifacts set definition_lifecycle=case status when 'under_review' then 'in_review' when 'published' then 'approved' else status end where artifact_type='component' and definition_lifecycle is null;
alter table public.guidebook_library_artifacts add constraint experience_component_definition_lifecycle_check check(artifact_type<>'component' or definition_lifecycle in('draft','in_review','approved','deprecated','archived'));

create table public.experience_component_presets(
 id uuid primary key default gen_random_uuid(), workspace_id uuid references public.owners(id), component_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict,
 name text not null, configuration jsonb not null default '{}'::jsonb, binding_defaults jsonb not null default '{}'::jsonb,
 scope text not null check(scope in('platform','workspace')), lifecycle_status text not null default 'draft' check(lifecycle_status in('draft','approved','archived')),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((scope='platform' and workspace_id is null)or(scope='workspace' and workspace_id is not null)),
 check(not(lower(configuration::text||binding_defaults::text)~'(wifi_password|wifi\.password|door_code|access\.code)')),
 unique nulls not distinct(workspace_id,component_version_id,name)
);
create table public.experience_component_insertions(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), idempotency_key text not null,
 component_instance_id uuid not null references public.guidebook_component_instances(id) on delete restrict, guidebook_version_id uuid not null references public.guidebook_canonical_versions(id) on delete restrict,
 inserted_by uuid not null references public.profiles(id), inserted_at timestamptz not null default now(), unique(workspace_id,idempotency_key)
);
create table public.experience_component_migrations(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id), component_instance_id uuid not null references public.guidebook_component_instances(id) on delete restrict,
 from_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict, to_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict,
 rollback_payload jsonb not null, migration_scope text not null check(migration_scope in('instance','guidebook','bulk')),
 status text not null default 'preview' check(status in('preview','approved','completed','rolled_back','failed')), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), completed_at timestamptz
);

alter table public.experience_component_presets enable row level security;
alter table public.experience_component_insertions enable row level security;
alter table public.experience_component_migrations enable row level security;
create policy "Admins govern platform component presets" on public.experience_component_presets for all to authenticated using(public.is_admin()or workspace_id=auth.uid()) with check(public.is_admin()or workspace_id=auth.uid());
create policy "Workspace component insertions" on public.experience_component_insertions for select to authenticated using(public.is_admin()or workspace_id=auth.uid());
create policy "Workspace component migrations" on public.experience_component_migrations for all to authenticated using(public.is_admin()or workspace_id=auth.uid()) with check(public.is_admin()or workspace_id=auth.uid());
revoke all on public.experience_component_presets,public.experience_component_insertions,public.experience_component_migrations from anon;
grant select,insert,update on public.experience_component_presets,public.experience_component_insertions,public.experience_component_migrations to authenticated;

with inventory(key,name,category,description,pdf_support) as(values
('hero','Hero','foundation','Editorial opening with title, message, and media.','supported'),
('rich_text','Rich Text','foundation','Structured long-form guest guidance.','supported'),('image','Image','foundation','Accessible single image with caption.','supported'),('gallery','Gallery','foundation','Keyboard-accessible media gallery.','fallback'),('callout','Callout','foundation','Highlighted information, reminder, or warning.','supported'),('divider','Divider','foundation','Semantic visual separation.','supported'),
('property_summary','Property Summary','arrival','Key property and stay facts.','supported'),('quick_actions','Quick Actions','arrival','High-priority arrival actions.','fallback'),('arrival_instructions','Arrival Instructions','arrival','Ordered guest arrival steps.','supported'),('address_card','Address Card','arrival','Property address and directions.','supported'),('parking_card','Parking Card','arrival','Parking location and instructions.','supported'),('access_instructions','Access Instructions','arrival','Protected property-entry guidance.','supported'),('wifi_card','Wi-Fi Card','arrival','Network access with masked copy and QR actions.','fallback'),
('rule_card','Rule Card','stay','Single guest policy or house rule.','supported'),('rule_grid','Rule Grid','stay','Scannable collection of house rules.','supported'),('appliance_card','Appliance Card','stay','Appliance instructions and tips.','supported'),('faq_accordion','FAQ Accordion','stay','Expandable common guest questions.','fallback'),('amenity_card','Amenity Card','stay','Amenity details and availability.','supported'),('host_contact_card','Host Contact Card','stay','Authorized host contact options.','supported'),
('safety_notice','Safety Notice','safety','Important safety guidance.','supported'),('safety_checklist','Safety Checklist','safety','Accessible safety tasks.','supported'),('emergency_contact_card','Emergency Contact Card','safety','Critical emergency contact information.','supported'),('emergency_resource_card','Emergency Resource Card','safety','Hospital and local emergency resources.','supported'),('critical_action_panel','Critical Action Panel','safety','Resilient critical guest actions.','supported'),
('recommendation_card','Recommendation Card','explore','Individual local recommendation.','supported'),('recommendation_collection','Recommendation Collection','explore','Ordered local recommendations.','supported'),('transportation_card','Transportation Card','explore','Local transportation option.','supported'),('map_panel','Map Panel','explore','Map with an accessible text alternative.','fallback'),('local_guide_category','Local Guide Category','explore','Category heading for local discovery.','supported'),
('departure_checklist','Departure Checklist','departure','Interactive and printable checkout tasks.','supported'),('checkout_summary','Checkout Summary','departure','Checkout timing and key reminders.','supported'),
('review_cta','Review CTA','engagement','Guest review request and destination.','supported'),('social_links','Social Links','engagement','Approved social destinations.','supported'),('newsletter_cta','Newsletter CTA','engagement','Optional guest newsletter invitation.','supported'),('thank_you_panel','Thank You Panel','engagement','Closing guest message.','supported'),
('section_header','Section Header','layout','Accessible section title and introduction.','supported'),('two_column_layout','Two-Column Layout','layout','Responsive two-column container.','fallback'),('card_grid','Card Grid','layout','Responsive card collection.','supported'),('tabs','Tabs','layout','Keyboard-navigable tab group.','fallback'),('accordion_group','Accordion Group','layout','Accessible disclosure group.','fallback'),('timeline','Timeline','layout','Ordered chronological content.','supported'),('step_list','Step List','layout','Ordered instructional steps.','supported'),('sticky_action_bar','Sticky Action Bar','layout','Mobile-priority persistent actions.','fallback')
), artifacts as(
 insert into public.guidebook_library_artifacts(artifact_type,canonical_key,name,description,category,tags,status,definition_lifecycle,current_version_number,supported_channels,metadata)
 select 'component',key,name,description,category,array[category,'v1'],'published','approved',1,array['responsive_web','mobile_web','pdf','guest_portal'],jsonb_build_object('componentKey',key,'pdfSupport',pdf_support,'governed',true)
 from inventory on conflict(artifact_type,ownership_scope,workspace_id,property_id,canonical_key) do update set name=excluded.name,description=excluded.description,category=excluded.category,supported_channels=excluded.supported_channels,metadata=excluded.metadata,definition_lifecycle=coalesce(public.guidebook_library_artifacts.definition_lifecycle,'approved'),updated_at=now() returning id,canonical_key
)
insert into public.guidebook_library_versions(artifact_id,version_number,status,payload,change_summary,published_at)
select artifact.id,1,'published',jsonb_build_object('contractVersion','experience-component.v1','contentSchema',jsonb_build_array(),'configurationSchema',jsonb_build_array(jsonb_build_object('key','layout','label','Layout','type','select','required',true,'allowedValues',jsonb_build_array('compact','standard','featured'))),'defaultConfiguration',jsonb_build_object('layout','standard'),'bindingContract',jsonb_build_object('modes',jsonb_build_array('inline','content_record','property_variable','collection','media')),'actionContract',jsonb_build_array(),'accessibilityContract',jsonb_build_object('standard','WCAG 2.2 AA','touchTargetMinimum',44,'reducedMotion',true),'analyticsContract',jsonb_build_object('baseContext',jsonb_build_array('guidebook_id','guidebook_version_id','publication_id','section_id','component_instance_id','component_definition_key','component_version'),'prohibitedFields',jsonb_build_array('wifi_password','door_code','guest_identity','message_contents','phone','email','sensitive_address')),'rendererContract',jsonb_build_object('responsive_web','supported','mobile_web','supported','pdf',inventory.pdf_support,'guest_portal','supported'),'compatibility',jsonb_build_object('guidebookSchemaVersions',jsonb_build_array('lhc-guidebook.v1')),'breakingChange',false),'Initial governed v1 component contract','2026-08-06T00:00:00Z'
from inventory join public.guidebook_library_artifacts artifact on artifact.artifact_type='component' and artifact.ownership_scope='luxe_haven' and artifact.canonical_key=inventory.key
on conflict(artifact_id,version_number) do nothing;
