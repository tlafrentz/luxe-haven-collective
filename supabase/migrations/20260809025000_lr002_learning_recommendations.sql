-- LR-002 Learning Recommendations: governed proposals from approved learning, never autonomous changes.
begin;

create table public.learning_recommendation_opportunities(
 id text primary key,
 workspace_id uuid not null,
 target_type text not null,
 target_id text not null,
 target_context_version integer not null check(target_context_version>0),
 property_ids uuid[] not null default '{}',
 relevant_capability text not null,
 opportunity_category text not null,
 trigger_type text not null,
 applicable_lesson_versions jsonb not null check(jsonb_typeof(applicable_lesson_versions)='array'),
 context_snapshot jsonb not null,
 applicability_summary jsonb not null,
 current_state_summary jsonb not null,
 potential_improvement_area text not null,
 related_record_references jsonb not null default '[]',
 conflict_indicators jsonb not null default '[]',
 data_quality text not null check(data_quality in('complete','sufficient','limited','conflicting','stale','missing','invalid')),
 status text not null check(status in('detected','candidate-created','dismissed','needs-reevaluation','expired','archived')),
 detection_policy_version text not null,
 idempotency_key text not null,
 detected_at timestamptz not null,
 version integer not null default 1 check(version>0),
 unique(workspace_id,idempotency_key)
);

create table public.learning_recommendation_versions(
 id text primary key,
 series_id text not null,
 version integer not null check(version>0),
 workspace_id uuid not null,
 title text not null check(btrim(title)<>''),
 proposal text not null check(btrim(proposal)<>''),
 description text,
 recommendation_type text not null,
 status text not null check(status in('draft','awaiting-context','ready-for-review','awaiting-review','revision-requested','accepted','rejected','deferred','dismissed','handed-off','in-progress','implemented','measurement-pending','evaluated','needs-reevaluation','superseded','expired','archived')),
 origin_type text not null,
 origin_id text,
 primary_lesson_id text references public.learning_lesson_versions(id) on delete restrict,
 target_type text not null,
 target_id text not null,
 target_context_version integer not null check(target_context_version>0),
 property_ids uuid[] not null default '{}',
 owner_scope jsonb,
 category text,
 applicability_match text check(applicability_match is null or applicability_match in('strong-match','qualified-match','partial-match','insufficient-context','excluded','not-applicable')),
 recommendation_confidence text check(recommendation_confidence is null or recommendation_confidence in('high','medium','low','unknown')),
 recommendation_strength text check(recommendation_strength is null or recommendation_strength in('strong','moderate','limited','investigatory','insufficient')),
 evidence_strength text check(evidence_strength is null or evidence_strength in('strong','moderate','limited','conflicting','insufficient')),
 expected_benefit text,
 expected_result text,
 potential_adverse_effects jsonb not null default '[]',
 risk_level text check(risk_level is null or risk_level in('low','medium','high','critical')),
 reversibility text,
 estimated_effort text,
 estimated_cost_category text,
 urgency text,
 dependencies jsonb not null default '[]',
 preconditions jsonb not null default '[]',
 required_approvals jsonb not null default '[]',
 measurement_readiness text,
 proposed_measurement jsonb,
 attribution_caveat text,
 limitations jsonb not null default '[]',
 conflict_state text,
 duplicate_state text,
 valid_until timestamptz,
 review_owner_profile_id uuid references public.profiles(id) on delete restrict,
 reviewer_profile_id uuid references public.profiles(id) on delete restrict,
 review_rationale text,
 disposition_reason text,
 downstream_handoff_type text,
 downstream_record_id text,
 created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 resolved_at timestamptz,
 supersedes_recommendation_id text references public.learning_recommendation_versions(id) on delete restrict,
 policy_version text not null,
 idempotency_key text,
 unique(series_id,version),
 unique(workspace_id,idempotency_key)
);

create table public.learning_recommendation_sources(
 workspace_id uuid not null,
 recommendation_version_id text not null references public.learning_recommendation_versions(id) on delete restrict,
 lesson_version_id text not null references public.learning_lesson_versions(id) on delete restrict,
 relationship text not null check(relationship in('primary','supporting','contradicting','limiting')),
 created_at timestamptz not null default now(),
 primary key(recommendation_version_id,lesson_version_id,relationship)
);

create table public.learning_recommendation_applicability(
 id text primary key,
 workspace_id uuid not null,
 recommendation_version_id text not null references public.learning_recommendation_versions(id) on delete restrict,
 lesson_version_id text not null references public.learning_lesson_versions(id) on delete restrict,
 target_context_version integer not null check(target_context_version>0),
 conditions_evaluated jsonb not null,
 matches jsonb not null default '[]',partial_matches jsonb not null default '[]',mismatches jsonb not null default '[]',unknowns jsonb not null default '[]',
 exclusions_evaluated jsonb not null default '[]',exclusions_triggered jsonb not null default '[]',contextual_differences jsonb not null default '[]',required_validation jsonb not null default '[]',
 match_classification text not null check(match_classification in('strong-match','qualified-match','partial-match','insufficient-context','excluded','not-applicable')),
 score numeric,
 explanation jsonb not null,
 policy_version text not null,
 evaluated_at timestamptz not null,
 version integer not null check(version>0),
 unique(recommendation_version_id,lesson_version_id,target_context_version,version)
);

create table public.learning_recommendation_relationships(
 id text primary key,workspace_id uuid not null,
 from_recommendation_id text not null references public.learning_recommendation_versions(id) on delete restrict,
 to_recommendation_id text not null references public.learning_recommendation_versions(id) on delete restrict,
 relationship_type text not null check(relationship_type in('supports','contradicts','depends-on','blocks','duplicates','refines','replaces','related-to','supersedes','superseded-by')),
 rationale text not null,created_by_profile_id uuid not null references public.profiles(id) on delete restrict,created_at timestamptz not null,
 check(from_recommendation_id<>to_recommendation_id),unique(from_recommendation_id,to_recommendation_id,relationship_type)
);

create table public.learning_recommendation_handoffs(
 id text primary key,workspace_id uuid not null,
 recommendation_version_id text not null references public.learning_recommendation_versions(id) on delete restrict,
 handoff_type text not null check(handoff_type in('decision','draft-action-plan','template-change-proposal','policy-review','measurement-change-proposal')),
 handoff_status text not null check(handoff_status in('requested','accepted','rejected','failed')),
 downstream_record_id text,downstream_record_version integer,
 correlation_id text not null,idempotency_key text not null,
 requested_by_profile_id uuid not null references public.profiles(id) on delete restrict,requested_at timestamptz not null,
 response_classification text,response_at timestamptz,
 unique(workspace_id,idempotency_key)
);

create table public.learning_recommendation_activity(
 id text primary key,workspace_id uuid not null,recommendation_series_id text not null,recommendation_version_id text,
 event_type text not null,actor_profile_id uuid references public.profiles(id) on delete restrict,occurred_at timestamptz not null,
 safe_metadata jsonb not null default '{}',correlation_id text not null,causation_id text,aggregate_version integer not null check(aggregate_version>0)
);

create index learning_recommendation_opportunity_queue_idx on public.learning_recommendation_opportunities(workspace_id,status,detected_at);
create index learning_recommendation_opportunity_property_idx on public.learning_recommendation_opportunities using gin(property_ids);
create index learning_recommendation_queue_idx on public.learning_recommendation_versions(workspace_id,status,valid_until,created_at);
create index learning_recommendation_property_idx on public.learning_recommendation_versions using gin(property_ids);
create index learning_recommendation_source_idx on public.learning_recommendation_sources(workspace_id,lesson_version_id,relationship);

alter table public.learning_recommendation_opportunities enable row level security;
alter table public.learning_recommendation_versions enable row level security;
alter table public.learning_recommendation_sources enable row level security;
alter table public.learning_recommendation_applicability enable row level security;
alter table public.learning_recommendation_relationships enable row level security;
alter table public.learning_recommendation_handoffs enable row level security;
alter table public.learning_recommendation_activity enable row level security;

create policy "Members inspect recommendation opportunities" on public.learning_recommendation_opportunities for select to authenticated using(public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members create recommendation opportunities" on public.learning_recommendation_opportunities for insert to authenticated with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator','contributor')and public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members inspect recommendations" on public.learning_recommendation_versions for select to authenticated using(public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members create recommendations" on public.learning_recommendation_versions for insert to authenticated with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator','contributor')and public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members inspect recommendation sources" on public.learning_recommendation_sources for select to authenticated using(exists(select 1 from public.learning_recommendation_versions recommendation where recommendation.id=recommendation_version_id and recommendation.workspace_id=learning_recommendation_sources.workspace_id and public.can_access_learning_properties(recommendation.workspace_id,recommendation.property_ids)));
create policy "Members inspect recommendation applicability" on public.learning_recommendation_applicability for select to authenticated using(exists(select 1 from public.learning_recommendation_versions recommendation where recommendation.id=recommendation_version_id and recommendation.workspace_id=learning_recommendation_applicability.workspace_id and public.can_access_learning_properties(recommendation.workspace_id,recommendation.property_ids)));
create policy "Members inspect recommendation relationships" on public.learning_recommendation_relationships for select to authenticated using(exists(select 1 from public.learning_recommendation_versions recommendation where recommendation.id=from_recommendation_id and recommendation.workspace_id=learning_recommendation_relationships.workspace_id and public.can_access_learning_properties(recommendation.workspace_id,recommendation.property_ids))and exists(select 1 from public.learning_recommendation_versions recommendation where recommendation.id=to_recommendation_id and recommendation.workspace_id=learning_recommendation_relationships.workspace_id and public.can_access_learning_properties(recommendation.workspace_id,recommendation.property_ids)));
create policy "Members inspect recommendation handoffs" on public.learning_recommendation_handoffs for select to authenticated using(exists(select 1 from public.learning_recommendation_versions recommendation where recommendation.id=recommendation_version_id and recommendation.workspace_id=learning_recommendation_handoffs.workspace_id and public.can_access_learning_properties(recommendation.workspace_id,recommendation.property_ids)));
create policy "Members inspect recommendation activity" on public.learning_recommendation_activity for select to authenticated using(public.active_workspace_role(workspace_id)is not null);

grant select,insert on public.learning_recommendation_opportunities,public.learning_recommendation_versions,public.learning_recommendation_sources,public.learning_recommendation_applicability,public.learning_recommendation_relationships,public.learning_recommendation_handoffs,public.learning_recommendation_activity to authenticated;
grant all on public.learning_recommendation_opportunities,public.learning_recommendation_versions,public.learning_recommendation_sources,public.learning_recommendation_applicability,public.learning_recommendation_relationships,public.learning_recommendation_handoffs,public.learning_recommendation_activity to service_role;

create trigger learning_recommendation_opportunities_append_only before update or delete on public.learning_recommendation_opportunities for each row execute function public.prevent_learning_history_change();
create trigger learning_recommendation_versions_append_only before update or delete on public.learning_recommendation_versions for each row execute function public.prevent_learning_history_change();
create trigger learning_recommendation_sources_append_only before update or delete on public.learning_recommendation_sources for each row execute function public.prevent_learning_history_change();
create trigger learning_recommendation_applicability_append_only before update or delete on public.learning_recommendation_applicability for each row execute function public.prevent_learning_history_change();
create trigger learning_recommendation_relationships_append_only before update or delete on public.learning_recommendation_relationships for each row execute function public.prevent_learning_history_change();
create trigger learning_recommendation_handoffs_append_only before update or delete on public.learning_recommendation_handoffs for each row execute function public.prevent_learning_history_change();
create trigger learning_recommendation_activity_append_only before update or delete on public.learning_recommendation_activity for each row execute function public.prevent_learning_history_change();

alter table public.execute_notification_outbox drop constraint if exists execute_notification_outbox_entity_type_check;
alter table public.execute_notification_outbox add constraint execute_notification_outbox_entity_type_check check(entity_type in('plan','action','evidence','blocker','dependency','recurrence','escalation','measurement','learning-signal','pattern','lesson','recommendation-opportunity','recommendation'));

commit;
