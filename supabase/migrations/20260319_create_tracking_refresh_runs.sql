create table if not exists public.tracking_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  status text not null,
  invocation_source text not null default 'manual',
  environment text null,
  requested_limit integer null,
  effective_limit integer null,
  pool_limit integer null,
  candidate_count integer null,
  eligible_count integer null,
  selected_count integer null,
  success_count integer null,
  failure_count integer null,
  skipped_count integer null,
  dry_run boolean not null default false,
  force_refresh boolean not null default false,
  card_id uuid null,
  error_text text null,
  notes text null,
  summary_json jsonb null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tracking_refresh_runs_started_idx
  on public.tracking_refresh_runs (started_at desc);

create index if not exists tracking_refresh_runs_status_idx
  on public.tracking_refresh_runs (status, started_at desc);

create index if not exists tracking_refresh_runs_card_idx
  on public.tracking_refresh_runs (card_id, started_at desc);

alter table public.tracking_refresh_runs enable row level security;
