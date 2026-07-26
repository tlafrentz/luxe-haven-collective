-- PC-001G.2: versioned measurement plans, retrieval, and immutable outcome reviews.
create table public.learning_measurement_plan_versions(
 id text primary key,series_id text not null,workspace_id uuid not null,learning_subject_id text not null references public.learning_subjects(id),revision integer not null check(revision>0),
 status text not null check(status in('draft','active','superseded','cancelled','completed')),title text not null,description text,execution_requirement text not null,
 owner_profile_id uuid references public.profiles(id),confidence text not null,policy_version text not null,evidence_references jsonb not null check(jsonb_typeof(evidence_references)='array'),
 created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null,activated_at timestamptz,superseded_at timestamptz,cancelled_at timestamptz,unique(series_id,revision)
);
create unique index learning_one_active_plan_revision on public.learning_measurement_plan_versions(series_id)where status='active';
create table public.learning_measurement_baselines(
 id text primary key,workspace_id uuid not null,measurement_plan_version_id text not null unique references public.learning_measurement_plan_versions(id),captured_at timestamptz not null,
 effective_start timestamptz,effective_end timestamptz,scope_reference jsonb not null,metric_values jsonb not null,qualification text not null,
 source_versions jsonb not null,evidence_references jsonb not null,confidence text not null,freshness text not null,schema_version text not null,created_at timestamptz not null default now(),
 check(effective_end is null or effective_start is null or effective_end>effective_start)
);
create table public.learning_expected_outcome_specifications(
 id text primary key,workspace_id uuid not null,measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id),metric_definition jsonb not null,
 baseline_value jsonb,expectation jsonb not null,tolerance jsonb,materiality_policy jsonb not null,weight numeric check(weight>0 and weight<=1),required boolean not null,
 measurement_source jsonb not null,qualification_expectation text[],confidence text not null,evidence_references jsonb not null,created_at timestamptz not null default now()
);
create table public.learning_review_windows(
 id text primary key,workspace_id uuid not null,measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id),sequence integer not null check(sequence>0),
 label text not null,trigger_definition jsonb not null,measurement_period_policy jsonb not null,review_opens_at timestamptz,review_due_at timestamptz,settlement_days integer not null default 0 check(settlement_days>=0),
 grace_period_days integer not null default 0 check(grace_period_days>=0),required boolean not null,timezone text not null,unique(measurement_plan_version_id,sequence)
);
create table public.learning_review_schedules(
 id text primary key,workspace_id uuid not null,measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id),measurement_plan_revision integer not null,
 review_window_id text not null references public.learning_review_windows(id),trigger_status text not null check(trigger_status in('waiting','satisfied','not-applicable','failed')),
 scheduled_open_at timestamptz,actual_open_at timestamptz,due_at timestamptz,outcome_review_id text,created_at timestamptz not null,unique(measurement_plan_version_id,review_window_id)
);
create table public.learning_outcome_review_revisions(
 id text primary key,series_id text not null,workspace_id uuid not null,learning_subject_id text not null references public.learning_subjects(id),
 measurement_plan_version_id text not null references public.learning_measurement_plan_versions(id),measurement_plan_revision integer not null,review_window_id text not null references public.learning_review_windows(id),
 revision integer not null check(revision>0),status text not null check(status in('scheduled','waiting','ready','measuring','in-review','completed','unable-to-evaluate','cancelled','superseded')),
 execution_context jsonb not null,expected_outcome_snapshots jsonb not null,measured_outcome_ids text[] not null default '{}',confidence text not null,data_freshness text not null,
 evaluation_policy_version text not null,evidence_references jsonb not null,unable_reasons text[],scheduled_at timestamptz,ready_at timestamptz,started_at timestamptz,completed_at timestamptz,
 completed_by_profile_id uuid references public.profiles(id),supersedes_review_id text references public.learning_outcome_review_revisions(id),correction_reason text,created_at timestamptz not null,
 unique(series_id,revision),check(status<>'unable-to-evaluate'or cardinality(unable_reasons)>0)
);
create unique index learning_one_active_review_per_schedule on public.learning_outcome_review_revisions(measurement_plan_version_id,review_window_id)where status not in('completed','unable-to-evaluate','cancelled','superseded');
create table public.learning_measured_outcome_revisions(
 id text primary key,series_id text not null,workspace_id uuid not null,outcome_review_id text not null references public.learning_outcome_review_revisions(id),expected_outcome_id text not null,
 metric_definition jsonb not null,value jsonb,measurement_start timestamptz not null,measurement_end timestamptz not null,observed_at timestamptz not null,
 qualification text not null check(qualification in('actual','estimated','derived','manual','provider-reported','unavailable')),source jsonb not null,
 status text not null check(status in('measured','partial','unavailable','superseded')),evidence_references jsonb not null,confidence text not null,freshness text not null,
 source_versions jsonb not null,measurement_policy_version text not null,revision integer not null check(revision>0),supersedes_measured_outcome_id text references public.learning_measured_outcome_revisions(id),
 created_at timestamptz not null,unique(series_id,revision),check(measurement_end>measurement_start),check(value is not null or status='unavailable')
);
create table public.learning_measurement_selections(
 outcome_review_id text not null references public.learning_outcome_review_revisions(id),review_revision integer not null,expected_outcome_id text not null,
 selected_measured_outcome_id text not null references public.learning_measured_outcome_revisions(id),selection_reason text not null,selected_by_profile_id uuid references public.profiles(id),
 selected_at timestamptz not null,workspace_id uuid not null,primary key(outcome_review_id,review_revision,expected_outcome_id)
);
create table public.learning_metric_evaluations(
 id text primary key,workspace_id uuid not null,outcome_review_id text not null references public.learning_outcome_review_revisions(id),review_revision integer not null,
 expected_outcome_id text not null,measured_outcome_id text references public.learning_measured_outcome_revisions(id),status text not null check(status in('exceeded','met','partially-met','did-not-meet','unable-to-evaluate')),
 expected_value jsonb,actual_value jsonb,absolute_variance numeric,relative_variance numeric,percentage_point_variance numeric,direction_evaluation text not null,materiality text not null,
 rationale jsonb not null,confidence text not null,evidence_references jsonb not null,evaluation_policy_version text not null,created_at timestamptz not null default now(),
 unique(outcome_review_id,review_revision,expected_outcome_id)
);
create table public.learning_review_summaries(
 id text primary key,workspace_id uuid not null,outcome_review_id text not null references public.learning_outcome_review_revisions(id),review_revision integer not null,status text not null,
 evaluated_metric_count integer not null,required_metric_count integer not null,unavailable_metric_count integer not null,weighted_score numeric,materiality text not null,
 primary_drivers text[] not null,limitations text[] not null,confidence text not null,created_at timestamptz not null default now(),unique(outcome_review_id,review_revision)
);
create table public.learning_measurement_jobs(
 id text primary key,workspace_id uuid not null,outcome_review_id text not null references public.learning_outcome_review_revisions(id),expected_outcome_id text not null,
 status text not null check(status in('queued','processing','completed','partial','failed','cancelled')),attempts integer not null default 0 check(attempts>=0),idempotency_key text not null,
 locked_at timestamptz,locked_by text,lease_expires_at timestamptz,failure_code text,failure_message text,created_at timestamptz not null,started_at timestamptz,completed_at timestamptz,
 unique(workspace_id,idempotency_key)
);
create table public.learning_measurement_command_receipts(
 id text primary key,workspace_id uuid not null,command_type text not null,idempotency_key text not null,aggregate_id text not null,input_hash text not null,result_reference jsonb not null,
 created_at timestamptz not null default now(),unique(workspace_id,command_type,idempotency_key)
);
alter table public.learning_activity drop constraint if exists learning_activity_event_type_check;
alter table public.learning_activity add constraint learning_activity_event_type_check check(event_type in('subject-created','measurement-created','review-created','lesson-created','lesson-updated','lesson-retired','measurement-plan-activated','review-scheduled','execution-confirmed','review-window-opened','review-ready','measurement-requested','measurement-retrieved','measurement-unavailable','manual-measurement-recorded','measurement-selected','review-started','metric-evaluated','review-completed','review-unable-to-evaluate','review-overdue','review-revision-created','review-superseded','review-cancelled','measurement-retried'));
alter table public.learning_domain_events drop constraint if exists learning_domain_events_event_type_check;
alter table public.learning_domain_events add constraint learning_domain_events_event_type_check check(event_type in('LearningSubjectCreated','OutcomeReviewCreated','LessonCreated','LessonRetired','MeasurementPlanActivated','OutcomeReviewScheduled','OutcomeReviewReady','MeasurementRetrievalRequested','MeasuredOutcomeRecorded','OutcomeReviewStarted','OutcomeReviewCompleted','OutcomeReviewUnableToEvaluate','OutcomeReviewOverdue','OutcomeReviewSuperseded'));
create index learning_review_queue_idx on public.learning_outcome_review_revisions(workspace_id,status,scheduled_at);
create index learning_review_due_idx on public.learning_review_schedules(workspace_id,due_at)where outcome_review_id is not null;
create index learning_measurement_review_idx on public.learning_measured_outcome_revisions(workspace_id,outcome_review_id,expected_outcome_id,revision desc);
create index learning_measurement_job_queue_idx on public.learning_measurement_jobs(status,lease_expires_at,created_at);
create index learning_plan_subject_revision_idx on public.learning_measurement_plan_versions(workspace_id,learning_subject_id,revision desc);

alter table public.learning_measurement_plan_versions enable row level security;alter table public.learning_measurement_baselines enable row level security;
alter table public.learning_expected_outcome_specifications enable row level security;alter table public.learning_review_windows enable row level security;
alter table public.learning_review_schedules enable row level security;alter table public.learning_outcome_review_revisions enable row level security;
alter table public.learning_measured_outcome_revisions enable row level security;alter table public.learning_measurement_selections enable row level security;
alter table public.learning_metric_evaluations enable row level security;alter table public.learning_review_summaries enable row level security;
alter table public.learning_measurement_jobs enable row level security;alter table public.learning_measurement_command_receipts enable row level security;
create policy "Members inspect measurement plans" on public.learning_measurement_plan_versions for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect measurement baselines" on public.learning_measurement_baselines for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect expected specifications" on public.learning_expected_outcome_specifications for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect review windows" on public.learning_review_windows for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect review schedules" on public.learning_review_schedules for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect outcome review revisions" on public.learning_outcome_review_revisions for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect measured outcome revisions" on public.learning_measured_outcome_revisions for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect measurement selections" on public.learning_measurement_selections for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect metric evaluations" on public.learning_metric_evaluations for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect review summaries" on public.learning_review_summaries for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Admins inspect measurement jobs" on public.learning_measurement_jobs for select to authenticated using(public.is_admin());
create policy "Admins inspect measurement receipts" on public.learning_measurement_command_receipts for select to authenticated using(public.is_admin());
grant select on public.learning_measurement_plan_versions,public.learning_measurement_baselines,public.learning_expected_outcome_specifications,public.learning_review_windows,public.learning_review_schedules,public.learning_outcome_review_revisions,public.learning_measured_outcome_revisions,public.learning_measurement_selections,public.learning_metric_evaluations,public.learning_review_summaries,public.learning_measurement_jobs,public.learning_measurement_command_receipts to authenticated;

create or replace function public.protect_learning_plan_version()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Learning measurement plan versions are retained';
 end if;
 if old.id<>new.id or old.series_id<>new.series_id or old.workspace_id<>new.workspace_id
  or old.learning_subject_id<>new.learning_subject_id or old.revision<>new.revision
  or old.title<>new.title or old.description is distinct from new.description
  or old.execution_requirement<>new.execution_requirement or old.owner_profile_id is distinct from new.owner_profile_id
  or old.confidence<>new.confidence or old.policy_version<>new.policy_version
  or old.evidence_references<>new.evidence_references or old.created_by_profile_id<>new.created_by_profile_id
  or old.created_at<>new.created_at
 then raise exception 'Activated Learning measurement-plan definitions are immutable';
 end if;
 if not (
   (old.status='draft' and new.status in('active','cancelled'))
   or (old.status='active' and new.status in('superseded','cancelled','completed'))
 ) then raise exception 'Invalid Learning measurement-plan lifecycle transition';
 end if;
 return new;
end $$;
create trigger learning_plan_versions_protected before update or delete on public.learning_measurement_plan_versions for each row execute function public.protect_learning_plan_version();
create trigger learning_baselines_append_only before update or delete on public.learning_measurement_baselines for each row execute function public.prevent_learning_history_change();
create trigger learning_expected_specs_append_only before update or delete on public.learning_expected_outcome_specifications for each row execute function public.prevent_learning_history_change();
create trigger learning_review_windows_append_only before update or delete on public.learning_review_windows for each row execute function public.prevent_learning_history_change();
create trigger learning_review_schedules_no_delete before delete on public.learning_review_schedules for each row execute function public.prevent_learning_history_change();
create trigger learning_review_revisions_append_only before update or delete on public.learning_outcome_review_revisions for each row execute function public.prevent_learning_history_change();
create trigger learning_measured_revisions_append_only before update or delete on public.learning_measured_outcome_revisions for each row execute function public.prevent_learning_history_change();
create trigger learning_selections_append_only before update or delete on public.learning_measurement_selections for each row execute function public.prevent_learning_history_change();
create trigger learning_metric_evaluations_append_only before update or delete on public.learning_metric_evaluations for each row execute function public.prevent_learning_history_change();
create trigger learning_review_summaries_append_only before update or delete on public.learning_review_summaries for each row execute function public.prevent_learning_history_change();
create trigger learning_measurement_receipts_append_only before update or delete on public.learning_measurement_command_receipts for each row execute function public.prevent_learning_history_change();
