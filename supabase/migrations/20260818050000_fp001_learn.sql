-- FP-001D Learn. Opportunities/actions/outcomes are admin-curated working
-- documents (correctable); monthly reviews, feedback, and the Day-90 review
-- are append-only records of what actually happened, using the same
-- reject_append_only_change() trigger already applied to admin_audit_events.
create table public.founding_partner_opportunities(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  pillar text check(pillar in('investment','financial','revenue','operations','guest-experience','risk','growth')),
  title text not null, evidence text not null default '', why_it_matters text not null default '',
  estimated_impact text not null default '', confidence text not null default 'unknown' check(confidence in('strong','moderate','weak','unknown')),
  recommended_action text not null default '', status text not null default 'identified' check(status in('identified','reviewing','actioned','deferred','dismissed')),
  source_lineage text not null default '', created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.founding_partner_actions(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  opportunity_id uuid references public.founding_partner_opportunities(id) on delete set null,
  decision text not null, action_description text not null default '', owner text not null default '',
  target_date date, status text not null default 'planned' check(status in('planned','in_progress','completed','abandoned')),
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.founding_partner_outcomes(
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null unique references public.founding_partner_actions(id) on delete restrict,
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  status text not null default 'not_measured' check(status in('not_measured','in_progress','measured','inconclusive')),
  estimated_value text not null default '', realized_value text not null default '', notes text not null default '',
  measured_by uuid references public.profiles(id), measured_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.founding_partner_monthly_reviews(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  review_month date not null, summary text not null default '', wins text not null default '',
  challenges text not null default '', next_focus text not null default '',
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(), unique(customer_program_id,review_month)
);
create table public.founding_partner_feedback(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null references public.customer_programs(id) on delete restrict,
  feedback_type text not null check(feedback_type in('feature_request','pain_point','positive_signal','concern','question')),
  signal_maturity text not null check(signal_maturity in('early_signal','recurring_theme','validated_pattern')),
  summary text not null, detail text not null default '',
  captured_by uuid references public.profiles(id), captured_at timestamptz not null default now()
);
create table public.founding_partner_day90_reviews(
  id uuid primary key default gen_random_uuid(),
  customer_program_id uuid not null unique references public.customer_programs(id) on delete restrict,
  value_delivered text not null default '', would_pay boolean, willingness_to_pay_notes text not null default '',
  testimonial_capture text not null default '',
  recommended_next_step text not null check(recommended_next_step in('convert','extend','exit')),
  rationale text not null, conducted_by uuid references public.profiles(id), conducted_at timestamptz not null default now()
);

create trigger founding_partner_monthly_reviews_append_only before update or delete on public.founding_partner_monthly_reviews
  for each row execute function public.reject_append_only_change();
create trigger founding_partner_feedback_append_only before update or delete on public.founding_partner_feedback
  for each row execute function public.reject_append_only_change();
create trigger founding_partner_day90_reviews_append_only before update or delete on public.founding_partner_day90_reviews
  for each row execute function public.reject_append_only_change();

do $$
declare v_constraint text;
begin
  for v_constraint in
    select c.conname from pg_catalog.pg_constraint c
    where c.conrelid='public.founding_partner_events'::regclass and c.contype='c'
  loop
    execute format('alter table public.founding_partner_events drop constraint %I',v_constraint);
  end loop;
end$$;
alter table public.founding_partner_events add constraint founding_partner_events_event_name_check
  check(event_name in('founding_partner_page_viewed','founding_partner_cta_clicked','founding_partner_application_started','founding_partner_application_completed','founding_partner_qualified','founding_partner_discovery_completed','founding_partner_accepted','founding_partner_onboarding_completed','founding_partner_baseline_completed','founding_partner_review_completed','founding_partner_day90_completed','founding_partner_converted','founding_partner_exited'));

alter table public.founding_partner_opportunities enable row level security;
alter table public.founding_partner_actions enable row level security;
alter table public.founding_partner_outcomes enable row level security;
alter table public.founding_partner_monthly_reviews enable row level security;
alter table public.founding_partner_feedback enable row level security;
alter table public.founding_partner_day90_reviews enable row level security;
create policy "admins manage founding opportunities" on public.founding_partner_opportunities for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding actions" on public.founding_partner_actions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding outcomes" on public.founding_partner_outcomes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding monthly reviews" on public.founding_partner_monthly_reviews for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding feedback" on public.founding_partner_feedback for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins manage founding day90 reviews" on public.founding_partner_day90_reviews for all to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.founding_partner_opportunities,public.founding_partner_actions,public.founding_partner_outcomes,public.founding_partner_monthly_reviews,public.founding_partner_feedback,public.founding_partner_day90_reviews from anon;
grant select,insert,update on public.founding_partner_opportunities,public.founding_partner_actions,public.founding_partner_outcomes to authenticated;
grant select,insert on public.founding_partner_monthly_reviews,public.founding_partner_feedback,public.founding_partner_day90_reviews to authenticated;
