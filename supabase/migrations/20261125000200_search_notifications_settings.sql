-- Phase 17: Search, Notifications, and Settings

-- 1. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tree_id uuid references public.family_trees(id) on delete cascade,
  category text not null check (category in ('invitation', 'correction', 'collaboration', 'book', 'job_failure')),
  title text not null,
  body text not null,
  link text,
  metadata jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select, update (read) on public.notifications to authenticated;

create policy notifications_self_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_self_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. USER PREFERENCES TABLE
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notify_email boolean not null default false,
  notify_push boolean not null default false,
  notify_invitations boolean not null default true,
  notify_corrections boolean not null default true,
  notify_collaboration boolean not null default true,
  notify_books boolean not null default true,
  notify_failures boolean not null default true,
  privacy_profile_visibility text not null default 'private' check (privacy_profile_visibility in ('private', 'members', 'public')),
  privacy_hide_living boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;

create policy preferences_self_all on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3. GLOBAL SEARCH RPC
-- Searches people, events, archive items, and books across trees the user has access to
create or replace function public.global_search(
  p_query text,
  p_tree_id uuid default null,
  p_category text default 'all',
  p_limit integer default 20,
  p_offset integer default 0
) returns table (
  id text,
  category text,
  tree_id uuid,
  tree_name text,
  title text,
  subtitle text,
  detail text,
  link text,
  created_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text;
begin
  if p_query is null or length(trim(p_query)) = 0 then
    return;
  end if;
  v_q := trim(p_query);

  return query
  with authorized_trees as (
    select t.id, t.name
    from public.family_trees t
    where t.owner_id = (select auth.uid()) or familyroots_private.current_tree_role(t.id) is not null
  ),
  matched_people as (
    select
      p.id::text as id,
      'person'::text as category,
      p.tree_id,
      at.name as tree_name,
      p.display_name as title,
      coalesce(p.birth_place, p.occupation, 'Person profile') as subtitle,
      coalesce(p.biography, '') as detail,
      ('/family-tree/' || p.id::text) as link,
      p.created_at
    from public.people p
    join authorized_trees at on at.id = p.tree_id
    where p.archived_at is null
      and (p_tree_id is null or p.tree_id = p_tree_id)
      and (p_category = 'all' or p_category = 'people')
      and (
        p.display_name ilike ('%' || v_q || '%')
        or exists (select 1 from jsonb_array_elements_text(coalesce(p.other_names, '[]'::jsonb)) a where a ilike ('%' || v_q || '%'))
        or p.occupation ilike ('%' || v_q || '%')
        or p.birth_place ilike ('%' || v_q || '%')
      )
  ),
  matched_events as (
    select
      e.id::text as id,
      'event'::text as category,
      e.tree_id,
      at.name as tree_name,
      coalesce(e.title, e.event_type) as title,
      coalesce(e.occurred_on::text, 'Milestone event') as subtitle,
      coalesce(e.description, '') as detail,
      ('/timeline/' || e.id::text) as link,
      e.created_at
    from public.life_events e
    join authorized_trees at on at.id = e.tree_id
    where (p_tree_id is null or e.tree_id = p_tree_id)
      and (p_category = 'all' or p_category = 'events')
      and (
        e.title ilike ('%' || v_q || '%')
        or e.description ilike ('%' || v_q || '%')
        or e.event_type ilike ('%' || v_q || '%')
      )
  ),
  matched_archive as (
    select
      a.id::text as id,
      'archive'::text as category,
      a.tree_id,
      at.name as tree_name,
      a.title,
      coalesce(a.source_note, a.mime_type) as subtitle,
      coalesce(a.description, '') as detail,
      ('/family-archive/' || a.id::text) as link,
      a.created_at
    from public.archive_items a
    join authorized_trees at on at.id = a.tree_id
    where a.state = 'ready'
      and (p_tree_id is null or a.tree_id = p_tree_id)
      and (p_category = 'all' or p_category = 'archive')
      and (
        a.title ilike ('%' || v_q || '%')
        or a.description ilike ('%' || v_q || '%')
        or a.source_note ilike ('%' || v_q || '%')
      )
  ),
  matched_books as (
    select
      b.id::text as id,
      'book'::text as category,
      b.tree_id,
      at.name as tree_name,
      coalesce(b.settings->>'title', 'Family History Book') as title,
      coalesce(b.settings->>'author', 'Book draft') as subtitle,
      coalesce(b.settings->>'subtitle', '') as detail,
      ('/my-books/' || b.id::text) as link,
      b.created_at
    from public.family_books b
    join authorized_trees at on at.id = b.tree_id
    where b.creator_id = (select auth.uid())
      and (p_tree_id is null or b.tree_id = p_tree_id)
      and (p_category = 'all' or p_category = 'books')
      and (
        (b.settings->>'title') ilike ('%' || v_q || '%')
        or (b.settings->>'subtitle') ilike ('%' || v_q || '%')
        or (b.settings->>'author') ilike ('%' || v_q || '%')
      )
  ),
  combined as (
    select * from matched_people
    union all
    select * from matched_events
    union all
    select * from matched_archive
    union all
    select * from matched_books
  )
  select * from combined
  order by created_at desc
  limit least(coalesce(p_limit, 20), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.global_search(text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.global_search(text, uuid, text, integer, integer) to authenticated;

-- 4. EXPORT PERSONAL DATA RPC
create or replace function public.export_personal_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
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

revoke all on function public.export_personal_data() from public, anon, authenticated;
grant execute on function public.export_personal_data() to authenticated;

-- 5. DELETE ACCOUNT RPC (According to documented ownership and retention rules)
create or replace function public.delete_user_account()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- 1. For each tree where user is owner:
  -- If another member exists, transfer ownership to the oldest editor or member.
  -- If no other member exists, delete the tree (cascades to all tree records).
  for r in select id from public.family_trees where owner_id = uid loop
    declare
      successor uuid;
    begin
      select user_id into successor
      from public.tree_memberships
      where tree_id = r.id and user_id <> uid
      order by case when role = 'editor' then 1 else 2 end, created_at asc
      limit 1;

      if successor is not null then
        update public.family_trees set owner_id = successor where id = r.id;
        update public.tree_memberships set role = 'owner' where tree_id = r.id and user_id = successor;
      else
        delete from public.family_trees where id = r.id;
      end if;
    end;
  end loop;

  -- 2. Remove memberships from other trees
  delete from public.tree_memberships where user_id = uid;

  -- 3. Delete personal notifications, preferences, and books
  delete from public.notifications where user_id = uid;
  delete from public.user_preferences where user_id = uid;
  delete from public.family_books where creator_id = uid;

  -- 4. Delete profile
  delete from public.profiles where id = uid;

  return true;
end;
$$;

revoke all on function public.delete_user_account() from public, anon, authenticated;
grant execute on function public.delete_user_account() to authenticated;
