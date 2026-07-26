-- PC-001G.1: capability-independent Learning lineage and append-only knowledge.
create table public.learning_subjects(
 id text primary key,workspace_id uuid not null,subject_type text not null check(subject_type in('investment-scenario','revenue-recommendation','capital-allocation','financial-plan','guest-communication','guidebook','property','portfolio-decision','operational-action')),
 source_capability text not null,source_id text not null,source_version text,created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null,unique(workspace_id,source_capability,source_id,source_version)
);
create table public.learning_lineage(
 id text primary key,workspace_id uuid not null,subject_id text not null references public.learning_subjects(id),from_reference jsonb not null,to_reference jsonb not null,
 relationship text not null check(relationship in('originated-from','recommended-by','decided-by','executed-by','measured-by','reviewed-by','supported-by','derived-lesson')),created_at timestamptz not null,
 check(jsonb_typeof(from_reference)='object'and jsonb_typeof(to_reference)='object')
);
create table public.learning_evidence(
 id text primary key,workspace_id uuid not null,evidence_references jsonb not null check(jsonb_typeof(evidence_references)='array'),confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),
 freshness text not null check(freshness in('current','stale','unknown')),captured_at timestamptz not null,created_at timestamptz not null default now()
);
create table public.learning_measurement_plans(
 id text primary key,workspace_id uuid not null,subject_id text not null references public.learning_subjects(id),baseline jsonb not null default '{}',
 window_type text not null check(window_type in('30-days','90-days','180-days','annual','custom')),window_start timestamptz not null,window_end timestamptz not null,
 confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),version integer not null check(version>0),created_at timestamptz not null,check(window_end>window_start),unique(subject_id,version)
);
create table public.learning_expected_outcomes(
 id text primary key,workspace_id uuid not null,measurement_plan_id text not null references public.learning_measurement_plans(id),metric text not null,expected_value jsonb not null,
 expected_direction text not null check(expected_direction in('increase','decrease','maintain','achieve','avoid','complete')),confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),
 evidence_id text references public.learning_evidence(id),created_at timestamptz not null default now()
);
create table public.learning_measured_outcomes(
 id text primary key,workspace_id uuid not null,subject_id text not null references public.learning_subjects(id),metric text not null,observed_value jsonb not null,
 observed_at timestamptz not null,evidence_id text not null references public.learning_evidence(id),recorded_at timestamptz not null,supersedes_measured_outcome_id text references public.learning_measured_outcomes(id)
);
create table public.learning_outcome_reviews(
 id text primary key,workspace_id uuid not null,subject_id text not null references public.learning_subjects(id),measurement_plan_id text not null references public.learning_measurement_plans(id),
 expected_outcome_ids text[] not null,measured_outcome_ids text[] not null default '{}',status text not null check(status in('pending','ready','completed','unable-to-evaluate')),
 evidence_ids text[] not null default '{}',supersedes_review_id text references public.learning_outcome_reviews(id),created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null,
 check(status<>'completed'or cardinality(evidence_ids)>0)
);
create table public.learning_assumption_results(
 id text primary key,workspace_id uuid not null,subject_id text not null references public.learning_subjects(id),review_id text not null references public.learning_outcome_reviews(id),assumption text not null,
 status text not null check(status in('confirmed','partially-confirmed','invalidated','unable-to-evaluate')),confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),
 evidence_ids text[] not null default '{}',created_at timestamptz not null
);
create table public.learning_lessons(
 id text primary key,workspace_id uuid not null,subject_id text not null references public.learning_subjects(id),statement text not null,applicability jsonb not null check(jsonb_typeof(applicability)='array'),
 confidence text not null check(confidence in('high','moderate','low','insufficient-evidence')),maturity text not null check(maturity in('emerging','supported','established','well-validated')),
 status text not null check(status in('candidate','validated','retired','contradicted')),lineage_edge_ids text[] not null,revision integer not null check(revision>0),
 supersedes_lesson_id text references public.learning_lessons(id),created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null,
 check(cardinality(lineage_edge_ids)>0)
);
create table public.learning_lesson_evidence(
 lesson_id text not null references public.learning_lessons(id),evidence_id text not null references public.learning_evidence(id),workspace_id uuid not null,created_at timestamptz not null default now(),primary key(lesson_id,evidence_id)
);
create table public.learning_activity(
 id text primary key,workspace_id uuid not null,subject_id text references public.learning_subjects(id),event_type text not null check(event_type in('subject-created','measurement-created','review-created','lesson-created','lesson-updated','lesson-retired')),
 actor_profile_id uuid references public.profiles(id),safe_summary text not null,occurred_at timestamptz not null
);
create table public.learning_domain_events(
 id text primary key,workspace_id uuid not null,aggregate_id text not null,event_type text not null check(event_type in('LearningSubjectCreated','OutcomeReviewCreated','LessonCreated','LessonRetired')),
 payload jsonb not null default '{}',occurred_at timestamptz not null,published_at timestamptz
);
create index learning_subject_source_idx on public.learning_subjects(workspace_id,source_capability,source_id);
create index learning_lineage_subject_idx on public.learning_lineage(workspace_id,subject_id,created_at);
create index learning_lineage_from_idx on public.learning_lineage using gin(from_reference);
create index learning_lineage_to_idx on public.learning_lineage using gin(to_reference);
create index learning_plan_subject_idx on public.learning_measurement_plans(workspace_id,subject_id,version desc);
create index learning_review_subject_idx on public.learning_outcome_reviews(workspace_id,subject_id,created_at desc);
create index learning_lesson_subject_idx on public.learning_lessons(workspace_id,subject_id,status,created_at desc);
create index learning_lesson_applicability_idx on public.learning_lessons using gin(applicability);
create index learning_activity_idx on public.learning_activity(workspace_id,occurred_at desc);
create index learning_events_unpublished_idx on public.learning_domain_events(occurred_at)where published_at is null;

alter table public.learning_subjects enable row level security;alter table public.learning_lineage enable row level security;alter table public.learning_evidence enable row level security;
alter table public.learning_measurement_plans enable row level security;alter table public.learning_expected_outcomes enable row level security;alter table public.learning_measured_outcomes enable row level security;
alter table public.learning_outcome_reviews enable row level security;alter table public.learning_assumption_results enable row level security;alter table public.learning_lessons enable row level security;
alter table public.learning_lesson_evidence enable row level security;alter table public.learning_activity enable row level security;alter table public.learning_domain_events enable row level security;
create policy "Members inspect learning subjects" on public.learning_subjects for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning lineage" on public.learning_lineage for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning evidence" on public.learning_evidence for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning plans" on public.learning_measurement_plans for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning expectations" on public.learning_expected_outcomes for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning measurements" on public.learning_measured_outcomes for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning reviews" on public.learning_outcome_reviews for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning assumptions" on public.learning_assumption_results for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning lessons" on public.learning_lessons for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect lesson evidence" on public.learning_lesson_evidence for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect learning activity" on public.learning_activity for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Admins inspect learning events" on public.learning_domain_events for select to authenticated using(public.is_admin());
grant select on public.learning_subjects,public.learning_lineage,public.learning_evidence,public.learning_measurement_plans,public.learning_expected_outcomes,public.learning_measured_outcomes,public.learning_outcome_reviews,public.learning_assumption_results,public.learning_lessons,public.learning_lesson_evidence,public.learning_activity,public.learning_domain_events to authenticated;

create or replace function public.prevent_learning_history_change()returns trigger language plpgsql set search_path='' as $$begin raise exception 'Learning history is append-only' using errcode='55000';end;$$;
create trigger learning_subjects_append_only before update or delete on public.learning_subjects for each row execute function public.prevent_learning_history_change();
create trigger learning_lineage_append_only before update or delete on public.learning_lineage for each row execute function public.prevent_learning_history_change();
create trigger learning_evidence_append_only before update or delete on public.learning_evidence for each row execute function public.prevent_learning_history_change();
create trigger learning_plans_append_only before update or delete on public.learning_measurement_plans for each row execute function public.prevent_learning_history_change();
create trigger learning_expected_append_only before update or delete on public.learning_expected_outcomes for each row execute function public.prevent_learning_history_change();
create trigger learning_measured_append_only before update or delete on public.learning_measured_outcomes for each row execute function public.prevent_learning_history_change();
create trigger learning_reviews_append_only before update or delete on public.learning_outcome_reviews for each row execute function public.prevent_learning_history_change();
create trigger learning_assumptions_append_only before update or delete on public.learning_assumption_results for each row execute function public.prevent_learning_history_change();
create trigger learning_lessons_append_only before update or delete on public.learning_lessons for each row execute function public.prevent_learning_history_change();
create trigger learning_lesson_evidence_append_only before update or delete on public.learning_lesson_evidence for each row execute function public.prevent_learning_history_change();
create trigger learning_activity_append_only before update or delete on public.learning_activity for each row execute function public.prevent_learning_history_change();
