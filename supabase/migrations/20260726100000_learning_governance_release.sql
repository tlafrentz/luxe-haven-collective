-- PC-001G.6: governed calibration, operational queues, alerts, and audit.
create table public.learning_calibrations(
 id text primary key,workspace_id uuid not null,lesson_id text not null references public.learning_lesson_versions(id),
 lesson_series_id text not null,lesson_revision integer not null check(lesson_revision>0),
 direction text not null check(direction in('increase-confidence','maintain-confidence','reduce-confidence','needs-review')),
 status text not null check(status in('pending','approved','rejected','failed','superseded')),
 previous_confidence text not null check(previous_confidence in('high','moderate','low','insufficient-evidence')),
 proposed_confidence text not null check(proposed_confidence in('high','moderate','low','insufficient-evidence')),
 previous_maturity text not null check(previous_maturity in('emerging','supported','established','well-validated')),
 proposed_maturity text not null check(proposed_maturity in('emerging','supported','established','well-validated')),
 reason text not null,evidence_references jsonb not null check(jsonb_typeof(evidence_references)='array'and jsonb_array_length(evidence_references)>0),
 reviewed_by_profile_id uuid not null references public.profiles(id),policy_version text not null,
 created_at timestamptz not null,reviewed_at timestamptz,supersedes_calibration_id text references public.learning_calibrations(id),
 unique(lesson_id,policy_version,status)
);
create table public.learning_governance_actions(
 id text primary key,workspace_id uuid not null,aggregate_type text not null check(aggregate_type in('lesson','calibration','contradiction','review','measurement-job')),
 aggregate_id text not null,action_type text not null check(action_type in('validate','revise','supersede','retire','merge','calibrate','resolve-contradiction','retry','governance-review')),
 previous_state jsonb,new_state jsonb,reason text not null,evidence_references jsonb not null default '[]',
 actor_profile_id uuid not null references public.profiles(id),policy_version text not null,idempotency_key text not null,
 occurred_at timestamptz not null,unique(workspace_id,action_type,idempotency_key)
);
create table public.learning_governance_jobs(
 id text primary key,workspace_id uuid not null,job_type text not null check(job_type in('measurement-retry','review-retry','calibration-retry')),
 aggregate_id text not null,status text not null check(status in('queued','processing','completed','failed','cancelled')),
 attempts integer not null default 0 check(attempts>=0),idempotency_key text not null,locked_at timestamptz,locked_by text,
 lease_expires_at timestamptz,failure_code text,failure_message text,created_at timestamptz not null,
 started_at timestamptz,completed_at timestamptz,unique(workspace_id,job_type,idempotency_key)
);
create table public.learning_operational_alerts(
 id text primary key,workspace_id uuid,severity text not null check(severity in('critical','high','medium','low')),
 alert_type text not null check(alert_type in('review-backlog','evidence-quality','contradiction-rate','measurement-failure','calibration-overdue','coverage-decline')),
 status text not null check(status in('open','acknowledged','resolved')),safe_summary text not null,
 metric_snapshot jsonb not null default '{}',policy_version text not null,detected_at timestamptz not null,
 acknowledged_by_profile_id uuid references public.profiles(id),acknowledged_at timestamptz,resolved_at timestamptz
);
create index learning_calibration_queue_idx on public.learning_calibrations(workspace_id,status,created_at);
create index learning_governance_action_idx on public.learning_governance_actions(workspace_id,occurred_at desc);
create index learning_governance_job_queue_idx on public.learning_governance_jobs(status,lease_expires_at,created_at);
create index learning_alert_queue_idx on public.learning_operational_alerts(status,severity,detected_at);

alter table public.learning_calibrations enable row level security;
alter table public.learning_governance_actions enable row level security;
alter table public.learning_governance_jobs enable row level security;
alter table public.learning_operational_alerts enable row level security;
create policy "Members inspect calibration history" on public.learning_calibrations for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Admins inspect governance actions" on public.learning_governance_actions for select to authenticated using(public.is_admin());
create policy "Admins inspect governance jobs" on public.learning_governance_jobs for select to authenticated using(public.is_admin());
create policy "Admins inspect learning alerts" on public.learning_operational_alerts for select to authenticated using(public.is_admin());
grant select on public.learning_calibrations,public.learning_governance_actions,public.learning_governance_jobs,public.learning_operational_alerts to authenticated;

create trigger learning_calibrations_append_only before update or delete on public.learning_calibrations for each row execute function public.prevent_learning_history_change();
create trigger learning_governance_actions_append_only before update or delete on public.learning_governance_actions for each row execute function public.prevent_learning_history_change();
