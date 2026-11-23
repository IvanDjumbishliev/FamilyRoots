create table public.archive_items (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (length(description) <= 4000),
  collection text check (length(collection) <= 120),
  location text check (length(location) <= 240),
  source_note text check (length(source_note) <= 2000),
  event_id uuid,
  recorded_on date,
  date_precision public.date_precision not null default 'unknown',
  date_approximate boolean not null default false,
  file_name text not null check (length(file_name) between 1 and 180),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf', 'text/plain')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  stored_bytes integer not null check (stored_bytes between 1 and 16252928 and stored_bytes >= size_bytes),
  object_path text not null unique,
  preview_path text,
  thumbnail_path text,
  state text not null default 'pending' check (state in ('pending', 'ready', 'failed', 'removed')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tree_id, id),
  foreign key(tree_id, event_id) references public.life_events(tree_id, id) on delete set null (event_id),
  check ((recorded_on is null) = (date_precision = 'unknown')),
  check (recorded_on is not null or not date_approximate),
  check (date_precision <> 'year' or extract(month from recorded_on) = 1),
  check (date_precision in ('unknown', 'day') or extract(day from recorded_on) = 1)
);
create unique index archive_items_live_hash_idx on public.archive_items(tree_id, sha256) where state in ('pending', 'ready');
create index archive_items_directory_idx on public.archive_items(tree_id, created_at desc, id) where state = 'ready';
create index archive_items_event_idx on public.archive_items(tree_id, event_id);

create table public.archive_item_people (
  tree_id uuid not null,
  item_id uuid not null,
  person_id uuid not null,
  primary key(item_id, person_id),
  foreign key(tree_id, item_id) references public.archive_items(tree_id, id) on delete cascade,
  foreign key(tree_id, person_id) references public.people(tree_id, id) on delete cascade
);
create index archive_item_people_person_idx on public.archive_item_people(tree_id, person_id);

alter table public.archive_items enable row level security;
alter table public.archive_item_people enable row level security;
revoke all on public.archive_items, public.archive_item_people from public, anon, authenticated;
grant select on public.archive_items, public.archive_item_people to authenticated;
grant select, update on public.archive_items to service_role;

create policy archive_items_members on public.archive_items for select to authenticated
  using (state = 'ready' and familyroots_private.current_tree_role(tree_id) is not null);
create policy archive_people_members on public.archive_item_people for select to authenticated
  using (exists (select 1 from public.archive_items a where a.id = item_id and a.tree_id = archive_item_people.tree_id));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('family-archive', 'family-archive', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);

-- Clients can read ready files belonging to their trees. Only the authenticated
-- validation function, through its server client, may create or remove objects.
create policy archive_objects_members on storage.objects for select to authenticated
  using (bucket_id = 'family-archive' and exists (
    select 1 from public.archive_items a where a.state = 'ready'
    and a.tree_id::text = split_part(storage.objects.name, '/', 1)
    and storage.objects.name in (a.object_path, a.preview_path, a.thumbnail_path)
  ));

create function familyroots_private.write_archive_metadata(
  p_id uuid, p_tree uuid, p_actor uuid, p_meta jsonb, p_people uuid[]
) returns void language plpgsql set search_path = '' as $$
begin
  if coalesce(cardinality(p_people), 0) > 50 then
    raise exception 'An archive item supports at most 50 people' using errcode = '23514';
  end if;
  update public.archive_items set
    title = btrim(p_meta->>'title'), description = nullif(btrim(p_meta->>'description'), ''),
    collection = nullif(btrim(p_meta->>'collection'), ''), location = nullif(btrim(p_meta->>'location'), ''),
    source_note = nullif(btrim(p_meta->>'sourceNote'), ''), event_id = nullif(p_meta->>'eventId', '')::uuid,
    recorded_on = nullif(p_meta->>'recordedOn', '')::date,
    date_precision = coalesce(p_meta->>'precision', 'unknown')::public.date_precision,
    date_approximate = coalesce((p_meta->>'approximate')::boolean, false),
    updated_by = p_actor, updated_at = now()
  where id = p_id and tree_id = p_tree;
  delete from public.archive_item_people where item_id = p_id;
  insert into public.archive_item_people(tree_id, item_id, person_id)
  select distinct p_tree, p_id, person from unnest(coalesce(p_people, '{}'::uuid[])) as person;
end;
$$;

create function public.claim_archive_upload(
  p_tree uuid, p_actor uuid, p_hash text, p_file_name text, p_mime text,
  p_size integer, p_stored_bytes integer, p_derivatives boolean, p_meta jsonb, p_people uuid[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item public.archive_items;
  next_id uuid := gen_random_uuid();
  root text := p_tree::text || '/' || next_id::text || '/';
  suffix text;
begin
  if not exists (select 1 from public.tree_memberships where tree_id = p_tree and user_id = p_actor and role in ('owner', 'editor')) then
    raise exception 'Archive write access required' using errcode = '42501';
  end if;
  perform 1 from public.family_trees where id = p_tree for update;
  update public.archive_items set state = 'failed', updated_at = now()
   where tree_id = p_tree and state = 'pending' and created_at < now() - interval '10 minutes';
  select * into item from public.archive_items where tree_id = p_tree and sha256 = p_hash and state in ('pending','ready');
  if found then return jsonb_build_object('id', item.id, 'duplicate', item.state = 'ready', 'pending', item.state = 'pending'); end if;
  if (select coalesce(sum(stored_bytes),0) from public.archive_items where tree_id = p_tree and state in ('pending','ready')) + p_stored_bytes > 524288000 then
    raise exception 'Archive storage limit reached' using errcode = '23514';
  end if;
  suffix := case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' end;
  insert into public.archive_items(id, tree_id, title, file_name, mime_type, sha256, size_bytes, stored_bytes, object_path,
    preview_path, thumbnail_path, uploaded_by, updated_by)
  values(next_id, p_tree, btrim(p_meta->>'title'), p_file_name, p_mime, p_hash, p_size, p_stored_bytes, root || 'original.' || suffix,
    case when p_derivatives then root || 'preview.jpg' end, case when p_derivatives then root || 'thumbnail.jpg' end, p_actor, p_actor)
  returning * into item;
  perform familyroots_private.write_archive_metadata(next_id, p_tree, p_actor, p_meta, p_people);
  return jsonb_build_object('id', next_id, 'objectPath', item.object_path, 'previewPath', item.preview_path, 'thumbnailPath', item.thumbnail_path);
end;
$$;

create function public.update_archive_item(p_id uuid, p_meta jsonb, p_people uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare item public.archive_items;
begin
  select * into item from public.archive_items where id = p_id and state = 'ready' for update;
  if not found or not coalesce(familyroots_private.current_tree_role(item.tree_id) in ('owner','editor'),false) then
    raise exception 'Archive write access required' using errcode = '42501';
  end if;
  perform familyroots_private.write_archive_metadata(p_id, item.tree_id, auth.uid(), p_meta, p_people);
end;
$$;

create function public.remove_archive_item(p_id uuid, p_actor uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare item public.archive_items;
begin
  select * into item from public.archive_items where id = p_id and state in ('ready','removed') for update;
  if not found or not exists (
    select 1 from public.tree_memberships where tree_id = item.tree_id and user_id = p_actor
    and (role = 'owner' or (role = 'editor' and item.uploaded_by = p_actor))
  ) then raise exception 'Archive removal access required' using errcode = '42501'; end if;
  if item.state = 'ready' then
    update public.archive_items set state = 'removed', updated_by = p_actor, updated_at = now() where id = p_id;
  end if;
  return array_remove(array[item.object_path, item.preview_path, item.thumbnail_path], null);
end;
$$;

create function familyroots_private.audit_archive()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'ready' or (old.state = 'ready' and new.state = 'removed') then
    insert into public.activity_logs(tree_id, actor_id, operation, entity_type, entity_id)
    values(new.tree_id, new.updated_by,
      case when old.state = 'pending' then 'insert' when new.state = 'removed' then 'delete' else 'update' end,
      'archive_items', new.id);
  end if;
  return null;
end;
$$;
create trigger audit_archive after update on public.archive_items
for each row execute function familyroots_private.audit_archive();

revoke all on function familyroots_private.write_archive_metadata(uuid,uuid,uuid,jsonb,uuid[]) from public, anon, authenticated;
revoke all on function familyroots_private.audit_archive() from public, anon, authenticated;
revoke all on function public.claim_archive_upload(uuid,uuid,text,text,text,integer,integer,boolean,jsonb,uuid[]) from public, anon, authenticated;
revoke all on function public.remove_archive_item(uuid,uuid) from public, anon, authenticated;
revoke all on function public.update_archive_item(uuid,jsonb,uuid[]) from public, anon, authenticated;
grant execute on function public.claim_archive_upload(uuid,uuid,text,text,text,integer,integer,boolean,jsonb,uuid[]) to service_role;
grant execute on function public.remove_archive_item(uuid,uuid) to service_role;
grant execute on function public.update_archive_item(uuid,jsonb,uuid[]) to authenticated;
