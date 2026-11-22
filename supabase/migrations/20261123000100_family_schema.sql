create schema if not exists familyroots_private;
revoke all on schema familyroots_private from public;
grant usage on schema familyroots_private to authenticated;

create type public.tree_role as enum ('owner', 'editor', 'viewer');
create type public.date_precision as enum ('unknown', 'year', 'month', 'day');
create type public.living_status as enum ('living', 'deceased', 'unknown');
create type public.parent_child_kind as enum ('biological', 'adoptive', 'step', 'foster', 'guardian', 'other');
create type public.partnership_kind as enum ('marriage', 'civil_union', 'domestic_partnership', 'other');
create type public.relationship_provenance as enum ('user_reported', 'documented', 'imported', 'ai_suggested');
create type public.verification_status as enum ('unverified', 'verified', 'disputed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index family_trees_owner_idx on public.family_trees(owner_id);

create table public.tree_memberships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.tree_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, user_id)
);
create unique index tree_memberships_single_owner_idx on public.tree_memberships(tree_id) where role = 'owner';
create index tree_memberships_user_idx on public.tree_memberships(user_id, tree_id);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  living_status public.living_status not null default 'unknown',
  birth_date date,
  birth_date_precision public.date_precision not null default 'unknown',
  birth_date_approximate boolean not null default false,
  death_date date,
  death_date_precision public.date_precision not null default 'unknown',
  death_date_approximate boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, id),
  check ((birth_date is null) = (birth_date_precision = 'unknown')),
  check (birth_date is not null or not birth_date_approximate),
  check ((death_date is null) = (death_date_precision = 'unknown')),
  check (death_date is not null or not death_date_approximate),
  check (living_status <> 'living' or death_date is null)
);
create index people_tree_created_idx on public.people(tree_id, created_at desc);

create table public.parent_child_relationships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  parent_id uuid not null,
  child_id uuid not null,
  kind public.parent_child_kind not null,
  provenance public.relationship_provenance not null default 'user_reported',
  verification_status public.verification_status not null default 'unverified',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, id),
  unique (tree_id, parent_id, child_id, kind),
  foreign key (tree_id, parent_id) references public.people(tree_id, id) on delete cascade,
  foreign key (tree_id, child_id) references public.people(tree_id, id) on delete cascade,
  check (parent_id <> child_id),
  check (provenance <> 'ai_suggested' or verification_status <> 'verified')
);
create index parent_child_child_idx on public.parent_child_relationships(tree_id, child_id);

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  person_a_id uuid not null,
  person_b_id uuid not null,
  kind public.partnership_kind not null,
  provenance public.relationship_provenance not null default 'user_reported',
  verification_status public.verification_status not null default 'unverified',
  started_on date,
  start_date_precision public.date_precision not null default 'unknown',
  start_date_approximate boolean not null default false,
  ended_on date,
  end_date_precision public.date_precision not null default 'unknown',
  end_date_approximate boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, id),
  foreign key (tree_id, person_a_id) references public.people(tree_id, id) on delete cascade,
  foreign key (tree_id, person_b_id) references public.people(tree_id, id) on delete cascade,
  check (person_a_id < person_b_id),
  check (provenance <> 'ai_suggested' or verification_status <> 'verified'),
  check ((started_on is null) = (start_date_precision = 'unknown')),
  check (started_on is not null or not start_date_approximate),
  check ((ended_on is null) = (end_date_precision = 'unknown')),
  check (ended_on is not null or not end_date_approximate)
);
create index partnerships_person_a_idx on public.partnerships(tree_id, person_a_id);
create index partnerships_person_b_idx on public.partnerships(tree_id, person_b_id);

create table public.life_events (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  person_id uuid,
  event_type text not null check (length(btrim(event_type)) between 1 and 80),
  title text not null check (length(btrim(title)) between 1 and 160),
  occurred_on date,
  date_precision public.date_precision not null default 'unknown',
  date_approximate boolean not null default false,
  place text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, id),
  foreign key (tree_id, person_id) references public.people(tree_id, id) on delete cascade,
  check ((occurred_on is null) = (date_precision = 'unknown')),
  check (occurred_on is not null or not date_approximate)
);
create index life_events_person_idx on public.life_events(tree_id, person_id);
create index life_events_timeline_idx on public.life_events(tree_id, occurred_on desc);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  person_id uuid,
  storage_path text not null unique,
  display_name text not null check (length(btrim(display_name)) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  captured_on date,
  date_precision public.date_precision not null default 'unknown',
  date_approximate boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, id),
  foreign key (tree_id, person_id) references public.people(tree_id, id) on delete set null (person_id),
  check (split_part(storage_path, '/', 1) = tree_id::text and storage_path ~ '^[^/]+/[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$'),
  check ((captured_on is null) = (date_precision = 'unknown')),
  check (captured_on is not null or not date_approximate)
);
create index media_assets_person_idx on public.media_assets(tree_id, person_id);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 255),
  repository_name text,
  reference_url text,
  rights_note text,
  record_date date,
  date_precision public.date_precision not null default 'unknown',
  date_approximate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, id),
  check ((record_date is null) = (date_precision = 'unknown')),
  check (record_date is not null or not date_approximate)
);

create table public.source_citations (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  source_id uuid not null,
  person_id uuid,
  relationship_id uuid,
  partnership_id uuid,
  life_event_id uuid,
  media_asset_id uuid,
  locator text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tree_id, source_id) references public.sources(tree_id, id) on delete cascade,
  foreign key (tree_id, person_id) references public.people(tree_id, id) on delete cascade,
  foreign key (tree_id, relationship_id) references public.parent_child_relationships(tree_id, id) on delete cascade,
  foreign key (tree_id, partnership_id) references public.partnerships(tree_id, id) on delete cascade,
  foreign key (tree_id, life_event_id) references public.life_events(tree_id, id) on delete cascade,
  foreign key (tree_id, media_asset_id) references public.media_assets(tree_id, id) on delete cascade,
  check (num_nonnulls(person_id, relationship_id, partnership_id, life_event_id, media_asset_id) = 1)
);
create index source_citations_source_idx on public.source_citations(tree_id, source_id);
create index source_citations_person_idx on public.source_citations(tree_id, person_id) where person_id is not null;
create index source_citations_relationship_idx on public.source_citations(tree_id, relationship_id) where relationship_id is not null;
create index source_citations_partnership_idx on public.source_citations(tree_id, partnership_id) where partnership_id is not null;
create index source_citations_event_idx on public.source_citations(tree_id, life_event_id) where life_event_id is not null;
create index source_citations_media_idx on public.source_citations(tree_id, media_asset_id) where media_asset_id is not null;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_logs_tree_created_idx on public.activity_logs(tree_id, created_at desc);
create index activity_logs_actor_idx on public.activity_logs(actor_id);

create function familyroots_private.sync_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger familyroots_create_profile after insert on auth.users
for each row execute function familyroots_private.sync_profile();
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

create function familyroots_private.set_write_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    if new.id is distinct from old.id
      or (to_jsonb(new)->'tree_id') is distinct from (to_jsonb(old)->'tree_id')
      or (to_jsonb(new)->'owner_id') is distinct from (to_jsonb(old)->'owner_id')
      or (to_jsonb(new)->'user_id') is distinct from (to_jsonb(old)->'user_id') then
      raise exception 'Record identity and ownership are immutable' using errcode = '23514';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function familyroots_private.add_tree_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tree_memberships(tree_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger familyroots_add_owner after insert on public.family_trees
for each row execute function familyroots_private.add_tree_owner();

create function familyroots_private.current_tree_role(target_tree uuid)
returns public.tree_role language sql stable security definer set search_path = '' as $$
  select m.role from public.tree_memberships m
  where m.tree_id = target_tree and m.user_id = (select auth.uid());
$$;

create function familyroots_private.log_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_tree uuid := (row_data->>case when tg_table_name = 'family_trees' then 'id' else 'tree_id' end)::uuid;
begin
  if exists (select 1 from public.family_trees where id = target_tree) then
    insert into public.activity_logs (tree_id, actor_id, operation, entity_type, entity_id)
    values (target_tree, (select auth.uid()), lower(tg_op), tg_table_name, (row_data->>'id')::uuid);
  end if;
  return null;
end;
$$;

do $$
declare
  relation_name text;
  private_tables text[] := array[
    'profiles', 'family_trees', 'tree_memberships', 'people', 'parent_child_relationships',
    'partnerships', 'life_events', 'media_assets', 'sources', 'source_citations', 'activity_logs'
  ];
begin
  foreach relation_name in array private_tables loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('revoke all on public.%I from public, anon, authenticated', relation_name);
    execute format('grant select on public.%I to authenticated', relation_name);
    execute format('create trigger set_write_metadata before insert or update on public.%I
      for each row execute function familyroots_private.set_write_metadata()', relation_name);
    if relation_name not in ('profiles', 'activity_logs') then
      execute format('create trigger log_change after insert or update or delete on public.%I
        for each row execute function familyroots_private.log_change()', relation_name);
    end if;
  end loop;
end;
$$;

revoke all on all functions in schema familyroots_private from public, anon, authenticated;
grant execute on function familyroots_private.current_tree_role(uuid) to authenticated;

grant update (display_name) on public.profiles to authenticated;
create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant insert (id, name, description), update (name, description) on public.family_trees to authenticated;
create policy trees_read_members on public.family_trees for select to authenticated
  using (owner_id = (select auth.uid()) or familyroots_private.current_tree_role(id) is not null);
create policy trees_create_owned on public.family_trees for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy trees_update_owner on public.family_trees for update to authenticated
  using (familyroots_private.current_tree_role(id) = 'owner')
  with check (familyroots_private.current_tree_role(id) = 'owner');

grant insert (tree_id, user_id, role), update (role), delete on public.tree_memberships to authenticated;
create policy memberships_read on public.tree_memberships for select to authenticated
  using (user_id = (select auth.uid()) or familyroots_private.current_tree_role(tree_id) = 'owner');
create policy memberships_insert_owner on public.tree_memberships for insert to authenticated
  with check (role <> 'owner' and familyroots_private.current_tree_role(tree_id) = 'owner');
create policy memberships_update_owner on public.tree_memberships for update to authenticated
  using (role <> 'owner' and familyroots_private.current_tree_role(tree_id) = 'owner')
  with check (role <> 'owner' and familyroots_private.current_tree_role(tree_id) = 'owner');
create policy memberships_delete_owner on public.tree_memberships for delete to authenticated
  using (role <> 'owner' and familyroots_private.current_tree_role(tree_id) = 'owner');

create policy activity_read_members on public.activity_logs for select to authenticated
  using (familyroots_private.current_tree_role(tree_id) is not null);

do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'people', 'parent_child_relationships', 'partnerships', 'life_events', 'media_assets', 'sources', 'source_citations'
  ] loop
    execute format('grant insert, update, delete on public.%I to authenticated', relation_name);
    execute format('create policy records_read_members on public.%I for select to authenticated
      using (familyroots_private.current_tree_role(tree_id) is not null)', relation_name);
    execute format('create policy records_insert_editors on public.%I for insert to authenticated
      with check (familyroots_private.current_tree_role(tree_id) in (''owner'', ''editor''))', relation_name);
    execute format('create policy records_update_editors on public.%I for update to authenticated
      using (familyroots_private.current_tree_role(tree_id) in (''owner'', ''editor''))
      with check (familyroots_private.current_tree_role(tree_id) in (''owner'', ''editor''))', relation_name);
    execute format('create policy records_delete_editors on public.%I for delete to authenticated
      using (familyroots_private.current_tree_role(tree_id) in (''owner'', ''editor''))', relation_name);
  end loop;
end;
$$;
