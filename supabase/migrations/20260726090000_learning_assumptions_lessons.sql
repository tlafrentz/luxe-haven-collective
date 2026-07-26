-- PC-001G.3: assumption validation and versioned organizational knowledge.
create table public.learning_assumptions(
 id text primary key,workspace_id uuid not null,learning_subject_id text not null references public.learning_subjects(id),
 statement text not null,category text not null check(category in('financial','revenue','investment','capital','operations','guest-experience','portfolio')),
 source_review_id text not null references public.learning_outcome_review_revisions(id),
 created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null
);
create table public.learning_validated_assumption_results(
 id text primary key,workspace_id uuid not null,assumption_id text not null references public.learning_assumptions(id),
 outcome_review_id text not null references public.learning_outcome_review_revisions(id),
 status text not null check(status in('confirmed','partially-confirmed','invalidated','unable-to-evaluate')),
 rationale text not null,confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),
 evidence_references jsonb not null check(jsonb_typeof(evidence_references)='array'and jsonb_array_length(evidence_references)>0),
 reviewed_by_profile_id uuid not null references public.profiles(id),policy_version text not null,created_at timestamptz not null,
 unique(assumption_id,outcome_review_id,policy_version)
);
create table public.learning_candidate_lessons(
 id text primary key,series_id text not null,revision integer not null check(revision>0),workspace_id uuid not null,
 learning_subject_id text not null references public.learning_subjects(id),
 category text not null check(category in('financial','revenue','investment','capital','operations','guest-experience','portfolio')),
 statement text not null,applicability jsonb not null check(jsonb_typeof(applicability)='array'and jsonb_array_length(applicability)>0),
 confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),
 evidence_references jsonb not null check(jsonb_typeof(evidence_references)='array'and jsonb_array_length(evidence_references)>0),
 source_review_ids text[] not null check(cardinality(source_review_ids)>0),
 source_assumption_result_ids text[] not null check(cardinality(source_assumption_result_ids)>0),
 status text not null check(status in('candidate','rejected','merged')),policy_version text not null,
 created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null,unique(series_id,revision)
);
create table public.learning_lesson_versions(
 id text primary key,series_id text not null,revision integer not null check(revision>0),workspace_id uuid not null,
 learning_subject_id text not null references public.learning_subjects(id),
 category text not null check(category in('financial','revenue','investment','capital','operations','guest-experience','portfolio')),
 statement text not null,confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),
 maturity text not null check(maturity in('emerging','supported','established','well-validated')),
 status text not null check(status in('candidate','validated','superseded','retired','contradicted','rejected')),
 contradiction_state text not null check(contradiction_state in('none','possible','confirmed')),
 evidence_references jsonb not null check(jsonb_typeof(evidence_references)='array'and jsonb_array_length(evidence_references)>0),
 source_review_ids text[] not null check(cardinality(source_review_ids)>0),
 source_candidate_ids text[] not null check(cardinality(source_candidate_ids)>0),policy_version text not null,
 supersedes_lesson_id text references public.learning_lesson_versions(id),retired_reason text,
 retired_by_profile_id uuid references public.profiles(id),retired_at timestamptz,
 created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null,
 unique(series_id,revision),check(status<>'retired'or(retired_reason is not null and retired_by_profile_id is not null and retired_at is not null))
);
create table public.learning_lesson_applicability(
 id text primary key,workspace_id uuid not null,lesson_version_id text not null references public.learning_lesson_versions(id),
 dimension text not null check(dimension in('workspace','portfolio','market','property','property-type','strategy','season','guest-segment','operating-model')),
 reference_id text,value text,created_at timestamptz not null default now(),
 check(reference_id is not null or value is not null),unique(lesson_version_id,dimension,reference_id,value)
);
create table public.learning_lesson_relationships(
 id text primary key,workspace_id uuid not null,from_lesson_id text not null references public.learning_lesson_versions(id),
 to_lesson_id text not null references public.learning_lesson_versions(id),
 relationship_type text not null check(relationship_type in('supports','contradicts','supersedes','merged-into','refines')),
 contradiction_state text not null check(contradiction_state in('none','possible','confirmed')),
 rationale text not null,evidence_references jsonb not null check(jsonb_typeof(evidence_references)='array'),
 policy_version text not null,created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null,
 check(from_lesson_id<>to_lesson_id),unique(from_lesson_id,to_lesson_id,relationship_type,policy_version)
);
create table public.learning_lesson_activity(
 id text primary key,workspace_id uuid not null,lesson_series_id text not null,lesson_version_id text,
 event_type text not null check(event_type in('assumption-validated','candidate-created','candidate-rejected','lesson-validated','lesson-revised','lesson-superseded','lesson-retired','contradiction-detected','contradiction-confirmed','lessons-merged','applicability-refined')),
 actor_profile_id uuid references public.profiles(id),safe_summary text not null,occurred_at timestamptz not null
);

alter table public.learning_domain_events drop constraint if exists learning_domain_events_event_type_check;
alter table public.learning_domain_events add constraint learning_domain_events_event_type_check check(event_type in(
 'LearningSubjectCreated','OutcomeReviewCreated','LessonCreated','LessonRetired',
 'MeasurementPlanActivated','OutcomeReviewScheduled','OutcomeReviewReady','MeasurementRetrievalRequested',
 'MeasuredOutcomeRecorded','OutcomeReviewStarted','OutcomeReviewCompleted','OutcomeReviewUnableToEvaluate',
 'OutcomeReviewOverdue','OutcomeReviewSuperseded','AssumptionValidated','CandidateLessonCreated',
 'LessonValidated','LessonSuperseded','LessonContradicted'
));
create index learning_assumption_review_idx on public.learning_assumptions(workspace_id,source_review_id);
create index learning_assumption_result_idx on public.learning_validated_assumption_results(workspace_id,outcome_review_id,status);
create index learning_candidate_queue_idx on public.learning_candidate_lessons(workspace_id,status,created_at);
create index learning_lesson_version_idx on public.learning_lesson_versions(workspace_id,series_id,revision desc);
create index learning_lesson_governance_idx on public.learning_lesson_versions(workspace_id,status,maturity,category);
create index learning_lesson_applicability_lookup_idx on public.learning_lesson_applicability(workspace_id,dimension,reference_id,value);
create index learning_lesson_relationship_idx on public.learning_lesson_relationships(workspace_id,relationship_type,contradiction_state);

alter table public.learning_assumptions enable row level security;
alter table public.learning_validated_assumption_results enable row level security;
alter table public.learning_candidate_lessons enable row level security;
alter table public.learning_lesson_versions enable row level security;
alter table public.learning_lesson_applicability enable row level security;
alter table public.learning_lesson_relationships enable row level security;
alter table public.learning_lesson_activity enable row level security;
create policy "Members inspect assumptions" on public.learning_assumptions for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect validated assumptions" on public.learning_validated_assumption_results for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect lesson candidates" on public.learning_candidate_lessons for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect lesson versions" on public.learning_lesson_versions for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect lesson applicability" on public.learning_lesson_applicability for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect lesson relationships" on public.learning_lesson_relationships for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect lesson activity" on public.learning_lesson_activity for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
grant select on public.learning_assumptions,public.learning_validated_assumption_results,public.learning_candidate_lessons,
 public.learning_lesson_versions,public.learning_lesson_applicability,public.learning_lesson_relationships,
 public.learning_lesson_activity to authenticated;

create trigger learning_assumptions_append_only before update or delete on public.learning_assumptions for each row execute function public.prevent_learning_history_change();
create trigger learning_validated_assumptions_append_only before update or delete on public.learning_validated_assumption_results for each row execute function public.prevent_learning_history_change();
create trigger learning_candidates_append_only before update or delete on public.learning_candidate_lessons for each row execute function public.prevent_learning_history_change();
create trigger learning_lesson_versions_append_only before update or delete on public.learning_lesson_versions for each row execute function public.prevent_learning_history_change();
create trigger learning_lesson_applicability_append_only before update or delete on public.learning_lesson_applicability for each row execute function public.prevent_learning_history_change();
create trigger learning_lesson_relationships_append_only before update or delete on public.learning_lesson_relationships for each row execute function public.prevent_learning_history_change();
create trigger learning_lesson_activity_append_only before update or delete on public.learning_lesson_activity for each row execute function public.prevent_learning_history_change();
