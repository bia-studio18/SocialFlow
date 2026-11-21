-- SocialFlow workspace data. Per-user rows are scoped in server functions.

create table if not exists profiles (
  user_id text primary key,
  display_name text not null default '',
  timezone text not null default 'Asia/Karachi',
  active_workspace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspaces (
  id text primary key,
  name text not null,
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_memberships (
  id text primary key,
  workspace_id text not null references workspaces (id) on delete cascade,
  user_id text not null,
  role text not null,
  email text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists memberships_user_idx on workspace_memberships (user_id);
create index if not exists memberships_email_idx on workspace_memberships (lower(email));

create table if not exists social_accounts (
  id text primary key,
  workspace_id text not null references workspaces (id) on delete cascade,
  platform text not null,
  display_name text not null,
  status text not null,
  status_detail text not null default '',
  external_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_accounts_ws_idx on social_accounts (workspace_id);

create table if not exists posts (
  id text primary key,
  workspace_id text not null references workspaces (id) on delete cascade,
  author_user_id text not null,
  caption text not null default '',
  hashtags text not null default '',
  status text not null,
  approval_status text not null default 'none',
  scheduled_at timestamptz,
  platforms text not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_ws_status_idx on posts (workspace_id, status);
create index if not exists posts_ws_sched_idx on posts (workspace_id, scheduled_at);

create table if not exists hashtags (
  id text primary key,
  tag text not null unique
);

create table if not exists post_hashtags (
  post_id text not null references posts (id) on delete cascade,
  hashtag_id text not null references hashtags (id) on delete cascade,
  primary key (post_id, hashtag_id)
);

create table if not exists media_assets (
  id text primary key,
  workspace_id text not null references workspaces (id) on delete cascade,
  name text not null,
  mime text not null,
  size_bytes integer not null,
  data_url text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists media_ws_idx on media_assets (workspace_id, created_at desc);

create table if not exists post_media (
  post_id text not null references posts (id) on delete cascade,
  media_id text not null references media_assets (id) on delete cascade,
  position integer not null default 0,
  primary key (post_id, media_id)
);

create table if not exists scheduled_posts (
  post_id text primary key references posts (id) on delete cascade,
  run_at timestamptz not null,
  status text not null default 'queued'
);

create table if not exists publish_attempts (
  id text primary key,
  workspace_id text not null references workspaces (id) on delete cascade,
  post_id text not null references posts (id) on delete cascade,
  platform text not null,
  status text not null,
  idempotency_key text not null,
  attempt_no integer not null default 1,
  error_code text not null default '',
  message text not null default '',
  external_id text not null default '',
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, platform, idempotency_key)
);

create index if not exists attempts_ws_idx on publish_attempts (workspace_id, created_at desc);

create table if not exists published_posts (
  id text primary key,
  post_id text not null references posts (id) on delete cascade,
  platform text not null,
  external_id text not null default '',
  published_at timestamptz not null default now(),
  unique (post_id, platform)
);

create table if not exists subscriptions (
  user_id text primary key,
  plan text not null default 'free',
  status text not null default 'active',
  billing_interval text not null default 'month',
  currency text not null default 'PKR',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  user_id text not null,
  plan text not null,
  amount integer not null,
  currency text not null,
  billing_interval text not null,
  status text not null,
  provider text not null default 'unconfigured',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  workspace_id text,
  kind text not null,
  title text not null,
  body text not null,
  ref_id text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create unique index if not exists notifications_ref_idx
  on notifications (user_id, kind, ref_id)
  where ref_id <> '';

create table if not exists audit_logs (
  id text primary key,
  workspace_id text,
  actor_user_id text not null,
  action text not null,
  entity text not null,
  entity_id text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_ws_idx on audit_logs (workspace_id, created_at desc);

create table if not exists ai_usage (
  id text primary key,
  user_id text not null,
  workspace_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_ws_idx on ai_usage (workspace_id, created_at desc);

create table if not exists analytics_snapshots (
  id text primary key,
  workspace_id text not null references workspaces (id) on delete cascade,
  platform text not null,
  metric text not null,
  availability text not null,
  value integer,
  captured_at timestamptz not null default now()
);

create index if not exists analytics_ws_idx on analytics_snapshots (workspace_id, captured_at desc);

create table if not exists oauth_states (
  id text primary key,
  workspace_id text not null references workspaces (id) on delete cascade,
  user_id text not null,
  platform text not null,
  state text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  event_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);
