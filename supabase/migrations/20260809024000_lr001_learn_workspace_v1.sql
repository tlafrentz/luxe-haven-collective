-- LR-001 Learn Workspace v1: normalized signals, explainable patterns, and governed lesson versions.
begin;

create or replace function public.can_access_learning_properties(p_workspace_id uuid,p_property_ids uuid[])
returns boolean language sql stable security definer set search_path='' as $$
 select public.active_workspace_role(p_workspace_id)is not null
 and not exists(select 1 from unnest(coalesce(p_property_ids,'{}'::uuid[]))property_id where not public.can_access_workspace_property(property_id));
$$;
revoke all on function public.can_access_learning_properties(uuid,uuid[]) from public;
grant execute on function public.can_access_learning_properties(uuid,uuid[]) to authenticated,service_role;

create table public.learning_signals(
 id text primary key,
 workspace_id uuid not null,
 source_type text not null check(source_type in('outcome','action','blocker','measurement','decision','recurring-occurrence','review-return')),
 source_record_id text not null,
 source_version integer not null check(source_version>0),
 source_status text not null,
 property_ids uuid[] not null default '{}',
 scope_type text not null check(scope_type in('property','selected-properties','portfolio','organization')),
 category text not null,
 normalized_result text not null,
 confidence text not null check(confidence in('high','medium','low','unknown')),
 data_quality text not null check(data_quality in('complete','sufficient','limited','conflicting','stale','missing','invalid')),
 observation_start timestamptz,
 observation_end timestamptz,
 observation_timezone text,
 effective_at timestamptz not null,
 context_attributes jsonb not null default '{}',
 eligibility_state text not null check(eligibility_state in('eligible','ineligible','invalidated','superseded')),
 eligibility_reason text not null,
 idempotency_key text not null,
 created_at timestamptz not null default now(),
 invalidated_at timestamptz,
 invalidated_by_signal_id text references public.learning_signals(id) on delete restrict,
 unique(workspace_id,source_type,source_record_id,source_version),
 unique(workspace_id,idempotency_key),
 check(observation_end is null or observation_start is null or observation_end>observation_start)
);

create table public.learning_patterns(
 id text primary key,
 series_id text not null,
 version integer not null check(version>0),
 workspace_id uuid not null,
 pattern_type text not null,
 title text not null check(btrim(title)<>''),
 description text not null,
 detection_method text not null,
 included_signal_count integer not null check(included_signal_count>=0),
 excluded_signal_count integer not null check(excluded_signal_count>=0),
 supporting_record_count integer not null check(supporting_record_count>=0),
 contradicting_record_count integer not null check(contradicting_record_count>=0),
 property_ids uuid[] not null default '{}',
 relevant_start timestamptz,
 relevant_end timestamptz,
 shared_context jsonb not null default '{}',
 contextual_differences jsonb not null default '[]',
 strength text not null check(strength in('strong','moderate','limited','conflicting','insufficient')),
 confidence text not null check(confidence in('high','medium','low','unknown')),
 status text not null check(status in('detected','candidate-created','dismissed','needs-reevaluation','superseded','archived')),
 explanation jsonb not null,
 detection_policy_version text not null,
 idempotency_key text not null,
 first_detected_at timestamptz not null,
 last_evaluated_at timestamptz not null,
 created_at timestamptz not null default now(),
 unique(series_id,version),
 unique(workspace_id,idempotency_key),
 check(relevant_end is null or relevant_start is null or relevant_end>relevant_start)
);

create table public.learning_pattern_signals(
 workspace_id uuid not null,
 pattern_id text not null references public.learning_patterns(id) on delete restrict,
 signal_id text not null references public.learning_signals(id) on delete restrict,
 relationship text not null check(relationship in('supporting','contradicting','excluded')),
 exclusion_reason text,
 created_at timestamptz not null default now(),
 primary key(pattern_id,signal_id),
 check(relationship<>'excluded'or nullif(btrim(exclusion_reason),'')is not null)
);

alter table public.learning_candidate_lessons
 drop constraint if exists learning_candidate_lessons_status_check;
alter table public.learning_candidate_lessons
 add constraint learning_candidate_lessons_status_check check(status in('candidate','draft','awaiting-evidence','ready-for-review','awaiting-review','rejected','merged','archived')),
 add column if not exists title text,
 add column if not exists description text,
 add column if not exists lesson_type text,
 add column if not exists secondary_tags text[] not null default '{}',
 add column if not exists property_ids uuid[] not null default '{}',
 add column if not exists evidence_strength text check(evidence_strength is null or evidence_strength in('strong','moderate','limited','conflicting','insufficient')),
 add column if not exists supporting_signal_ids text[] not null default '{}',
 add column if not exists contradicting_signal_ids text[] not null default '{}',
 add column if not exists related_pattern_ids text[] not null default '{}',
 add column if not exists applicability_conditions jsonb not null default '[]',
 add column if not exists exclusions jsonb not null default '[]',
 add column if not exists limitations jsonb not null default '[]',
 add column if not exists attribution_caveat text,
 add column if not exists review_owner_profile_id uuid references public.profiles(id) on delete restrict,
 add column if not exists submitted_by_profile_id uuid references public.profiles(id) on delete restrict,
 add column if not exists submitted_at timestamptz,
 add column if not exists rejection_reason text,
 add column if not exists idempotency_key text;
create unique index lr001_candidate_idempotency_idx on public.learning_candidate_lessons(workspace_id,idempotency_key)where idempotency_key is not null;

alter table public.learning_lesson_versions
 drop constraint if exists learning_lesson_versions_status_check;
alter table public.learning_lesson_versions
 add constraint learning_lesson_versions_status_check check(status in('candidate','validated','approved','needs-reevaluation','superseded','retired','contradicted','rejected','archived')),
 add column if not exists title text,
 add column if not exists description text,
 add column if not exists lesson_type text,
 add column if not exists secondary_tags text[] not null default '{}',
 add column if not exists property_ids uuid[] not null default '{}',
 add column if not exists evidence_strength text check(evidence_strength is null or evidence_strength in('strong','moderate','limited','conflicting','insufficient')),
 add column if not exists supporting_signal_ids text[] not null default '{}',
 add column if not exists contradicting_signal_ids text[] not null default '{}',
 add column if not exists related_pattern_ids text[] not null default '{}',
 add column if not exists applicability_conditions jsonb not null default '[]',
 add column if not exists exclusions jsonb not null default '[]',
 add column if not exists limitations jsonb not null default '[]',
 add column if not exists attribution_caveat text,
 add column if not exists reviewer_profile_id uuid references public.profiles(id) on delete restrict,
 add column if not exists review_rationale text,
 add column if not exists approved_by_profile_id uuid references public.profiles(id) on delete restrict,
 add column if not exists approved_at timestamptz,
 add column if not exists reevaluation_reason text,
 add column if not exists last_reviewed_at timestamptz;

alter table public.learning_lesson_relationships drop constraint if exists learning_lesson_relationships_relationship_type_check;
alter table public.learning_lesson_relationships add constraint learning_lesson_relationships_relationship_type_check check(relationship_type in('supports','contradicts','supersedes','superseded-by','duplicates','related-to','merged-into','refines'));

alter table public.learning_lesson_activity drop constraint if exists learning_lesson_activity_event_type_check;
alter table public.learning_lesson_activity add constraint learning_lesson_activity_event_type_check check(event_type in('assumption-validated','candidate-created','candidate-updated','candidate-rejected','candidate-submitted','candidate-returned','lesson-validated','lesson-approved','lesson-revised','lesson-superseded','lesson-retired','lesson-reinstated','lesson-archived','lesson-needs-reevaluation','lesson-reevaluated','contradiction-detected','contradiction-confirmed','lessons-merged','lesson-related','applicability-refined','confidence-overridden','evidence-added','evidence-removed','signal-created','signal-invalidated','pattern-detected','pattern-reevaluated'));

create index learning_signal_queue_idx on public.learning_signals(workspace_id,eligibility_state,effective_at);
create index learning_signal_property_idx on public.learning_signals using gin(property_ids);
create index learning_pattern_queue_idx on public.learning_patterns(workspace_id,status,last_evaluated_at);
create index learning_pattern_property_idx on public.learning_patterns using gin(property_ids);

alter table public.learning_signals enable row level security;
alter table public.learning_patterns enable row level security;
alter table public.learning_pattern_signals enable row level security;
create policy "Members inspect authorized learning signals" on public.learning_signals for select to authenticated using(public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members create authorized learning signals" on public.learning_signals for insert to authenticated with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator','contributor')and public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members inspect authorized learning patterns" on public.learning_patterns for select to authenticated using(public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members create authorized learning patterns" on public.learning_patterns for insert to authenticated with check(public.active_workspace_role(workspace_id)in('owner','administrator','operator','contributor')and public.can_access_learning_properties(workspace_id,property_ids));
create policy "Members inspect authorized pattern signals" on public.learning_pattern_signals for select to authenticated using(exists(select 1 from public.learning_patterns pattern where pattern.id=pattern_id and pattern.workspace_id=learning_pattern_signals.workspace_id and public.can_access_learning_properties(pattern.workspace_id,pattern.property_ids)));
create policy "Members create authorized pattern signals" on public.learning_pattern_signals for insert to authenticated with check(exists(select 1 from public.learning_patterns pattern where pattern.id=pattern_id and pattern.workspace_id=learning_pattern_signals.workspace_id and public.can_access_learning_properties(pattern.workspace_id,pattern.property_ids))and exists(select 1 from public.learning_signals signal where signal.id=signal_id and signal.workspace_id=learning_pattern_signals.workspace_id and public.can_access_learning_properties(signal.workspace_id,signal.property_ids)));

drop policy if exists "Members inspect lesson candidates" on public.learning_candidate_lessons;
create policy "Members inspect authorized lesson candidates" on public.learning_candidate_lessons for select to authenticated using(public.can_access_learning_properties(workspace_id,property_ids));
drop policy if exists "Members inspect lesson versions" on public.learning_lesson_versions;
create policy "Members inspect authorized lesson versions" on public.learning_lesson_versions for select to authenticated using(public.can_access_learning_properties(workspace_id,property_ids));

grant select,insert on public.learning_signals,public.learning_patterns,public.learning_pattern_signals to authenticated;
grant all on public.learning_signals,public.learning_patterns,public.learning_pattern_signals to service_role;
create trigger learning_signals_append_only before update or delete on public.learning_signals for each row execute function public.prevent_learning_history_change();
create trigger learning_patterns_append_only before update or delete on public.learning_patterns for each row execute function public.prevent_learning_history_change();
create trigger learning_pattern_signals_append_only before update or delete on public.learning_pattern_signals for each row execute function public.prevent_learning_history_change();

alter table public.execute_notification_outbox drop constraint if exists execute_notification_outbox_entity_type_check;
alter table public.execute_notification_outbox add constraint execute_notification_outbox_entity_type_check check(entity_type in('plan','action','evidence','blocker','dependency','recurrence','escalation','measurement','learning-signal','pattern','lesson'));

commit;
