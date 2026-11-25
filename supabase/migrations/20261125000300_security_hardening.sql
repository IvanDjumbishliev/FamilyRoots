-- Phase 18: Security and Privacy Hardening
-- Adds rate-limiting bucket table, minor consent flags, and cross-tree security enhancements

-- 1. SECURITY RATE LIMITING TABLE
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  action text not null,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

create index if not exists rate_limits_key_action_idx on public.rate_limits(key, action, window_start desc);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

-- Rate limiter function for sensitive client operations (e.g. search, exports, auth actions)
create or replace function public.check_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid text := coalesce(auth.uid()::text, 'anonymous');
  v_count integer;
  v_window_start timestamptz;
begin
  select count, window_start into v_count, v_window_start
  from public.rate_limits
  where key = v_uid and action = p_action and window_start > now() - (p_window_seconds || ' seconds')::interval
  order by window_start desc
  limit 1
  for update;

  if not found then
    insert into public.rate_limits(key, action, count, window_start)
    values (v_uid, p_action, 1, now());
    return true;
  end if;

  if v_count >= p_max_requests then
    return false;
  end if;

  update public.rate_limits
  set count = count + 1
  where key = v_uid and action = p_action and window_start = v_window_start;

  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

-- 2. MINOR PROTECTION & PARENTAL CONSENT ENHANCEMENTS
-- Add parental consent tracking and minor protection flag to profiles and people
alter table public.profiles
  add column if not exists is_minor boolean not null default false,
  add column if not exists parental_consent_verified boolean not null default false,
  add column if not exists parental_consent_recorded_at timestamptz;

-- 3. RATE-LIMITED EXPORT & SEARCH
-- Apply rate limit check to export_personal_data
create or replace function public.export_personal_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  result jsonb;
  allowed boolean;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Enforce rate limit: max 5 exports per hour
  allowed := public.check_rate_limit('export_personal_data', 5, 3600);
  if not allowed then
    raise exception 'Export rate limit exceeded. Please try again later.' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'preferences', (select to_jsonb(pr) from public.user_preferences pr where pr.user_id = uid),
    'trees', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tree_id', t.id,
        'name', t.name,
        'role', m.role,
        'joined_at', m.created_at
      )), '[]'::jsonb)
      from public.tree_memberships m
      join public.family_trees t on t.id = m.tree_id
      where m.user_id = uid
    ),
    'books', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'title', b.settings->>'title',
        'status', b.status,
        'created_at', b.created_at,
        'settings', b.settings,
        'sections', b.sections
      )), '[]'::jsonb)
      from public.family_books b
      where b.creator_id = uid
    ),
    'notifications', (
      select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
      from public.notifications n
      where n.user_id = uid
    )
  ) into result;

  return result;
end;
$$;
