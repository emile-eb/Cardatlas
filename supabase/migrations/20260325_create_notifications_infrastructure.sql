alter table public.user_devices
  add column if not exists device_id text,
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists market_activity_enabled boolean not null default true,
  add column if not exists collection_updates_enabled boolean not null default true,
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists permission_status text not null default 'undetermined',
  add column if not exists push_token_status text not null default 'missing',
  add column if not exists push_token_registered_at timestamptz null,
  add column if not exists last_error_text text null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.user_devices
set
  device_id = coalesce(nullif(device_id, ''), id::text),
  notifications_enabled = coalesce(notifications_enabled, true),
  market_activity_enabled = coalesce(market_activity_enabled, true),
  collection_updates_enabled = coalesce(collection_updates_enabled, true),
  reminders_enabled = coalesce(reminders_enabled, true),
  permission_status = coalesce(nullif(permission_status, ''), 'undetermined'),
  push_token_status = case
    when expo_push_token is null or expo_push_token = '' then 'missing'
    else coalesce(nullif(push_token_status, ''), 'active')
  end,
  push_token_registered_at = case
    when expo_push_token is null or expo_push_token = '' then push_token_registered_at
    else coalesce(push_token_registered_at, last_seen_at, timezone('utc', now()))
  end,
  updated_at = timezone('utc', now())
where true;

create unique index if not exists user_devices_user_device_idx
  on public.user_devices (user_id, device_id);

create index if not exists user_devices_push_token_idx
  on public.user_devices (expo_push_token)
  where expo_push_token is not null;

create index if not exists user_devices_notification_state_idx
  on public.user_devices (user_id, notifications_enabled, permission_status, push_token_status);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  card_id uuid null references public.cards (id) on delete cascade,
  notification_type text not null,
  dedupe_key text not null,
  payload_json jsonb null,
  status text not null default 'queued',
  sent_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists notification_events_dedupe_key_idx
  on public.notification_events (dedupe_key);

create index if not exists notification_events_user_created_idx
  on public.notification_events (user_id, created_at desc);

create index if not exists notification_events_card_type_idx
  on public.notification_events (card_id, notification_type, created_at desc);

alter table public.notification_events enable row level security;
