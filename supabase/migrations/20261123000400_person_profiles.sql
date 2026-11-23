alter table public.people
  add column given_names text check (length(given_names) <= 160),
  add column surnames text check (length(surnames) <= 160),
  add column birth_name text check (length(birth_name) <= 160),
  add column alternative_names text[] not null default '{}' check (cardinality(alternative_names) <= 20),
  add column gender_identity text check (length(gender_identity) <= 100),
  add column birth_place text check (length(birth_place) <= 240),
  add column death_place text check (length(death_place) <= 240),
  add column biography text check (length(biography) <= 10000),
  add column occupation text check (length(occupation) <= 160),
  add column nationality text check (length(nationality) <= 160),
  add column verification_status public.verification_status not null default 'unverified',
  add column is_draft boolean not null default false,
  add column archived_at timestamptz,
  add column profile_photo_id uuid,
  add constraint living_person_death_place_check check (living_status <> 'living' or death_place is null);

-- Normalize earlier partial dates to the same canonical representation as the app.
update public.people set birth_date = date_trunc(birth_date_precision::text, birth_date::timestamp)::date
where birth_date_precision in ('year', 'month') and birth_date is distinct from date_trunc(birth_date_precision::text, birth_date::timestamp)::date;
update public.people set death_date = date_trunc(death_date_precision::text, death_date::timestamp)::date
where death_date_precision in ('year', 'month') and death_date is distinct from date_trunc(death_date_precision::text, death_date::timestamp)::date;
alter table public.people
  add constraint people_birth_precision_storage_check check (
    birth_date is null or
    (birth_date_precision <> 'year' or extract(month from birth_date) = 1)
    and (birth_date_precision = 'day' or extract(day from birth_date) = 1)
  ) not valid,
  add constraint people_death_precision_storage_check check (
    death_date is null or
    (death_date_precision <> 'year' or extract(month from death_date) = 1)
    and (death_date_precision = 'day' or extract(day from death_date) = 1)
  ) not valid,
  add constraint people_date_order_check check (
    birth_date is null or death_date is null or birth_date_approximate or death_date_approximate
    or birth_date <= case death_date_precision
      when 'year' then death_date + interval '1 year' - interval '1 day'
      when 'month' then death_date + interval '1 month' - interval '1 day'
      else death_date::timestamp
    end
  ) not valid;

alter table public.people validate constraint people_birth_precision_storage_check;
alter table public.people validate constraint people_death_precision_storage_check;

create index people_directory_idx on public.people(tree_id, display_name, id);
create index people_archived_idx on public.people(tree_id, archived_at) where archived_at is not null;

alter table public.media_assets
  add unique (tree_id, id, person_id);
alter table public.people
  add constraint people_profile_photo_fkey foreign key (tree_id, profile_photo_id, id)
  references public.media_assets(tree_id, id, person_id) on delete set null (profile_photo_id);

alter table public.activity_logs add column changed_fields text[] not null default '{}';
create index activity_logs_entity_idx on public.activity_logs(tree_id, entity_type, entity_id, created_at desc);

create or replace function familyroots_private.log_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_tree uuid := (row_data->>case when tg_table_name = 'family_trees' then 'id' else 'tree_id' end)::uuid;
  fields text[] := '{}';
begin
  if tg_table_name = 'people' and tg_op = 'UPDATE' then
    select coalesce(array_agg(item.key order by item.key), '{}') into fields
    from jsonb_each(row_data - 'updated_at') item
    where item.value is distinct from (to_jsonb(old)->item.key);
    if cardinality(fields) = 0 then return null; end if;
  end if;
  if exists (select 1 from public.family_trees where id = target_tree) then
    insert into public.activity_logs (tree_id, actor_id, operation, entity_type, entity_id, changed_fields)
    values (target_tree, (select auth.uid()), lower(tg_op), tg_table_name, (row_data->>'id')::uuid, fields);
    if tg_table_name = 'source_citations' and row_data->>'person_id' is not null then
      insert into public.activity_logs (tree_id, actor_id, operation, entity_type, entity_id, changed_fields)
      values (target_tree, (select auth.uid()), 'update', 'people', (row_data->>'person_id')::uuid, array['sources']);
    end if;
  end if;
  return null;
end;
$$;

-- Archive keeps relationships, sources, photos and the audit trail intact.
revoke delete on public.people from authenticated;

create function public.add_person_source(
  p_tree_id uuid, p_person_id uuid, p_title text, p_url text, p_locator text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  source uuid;
  citation uuid;
begin
  if nullif(btrim(p_url), '') is not null and p_url !~ '^https?://' then
    raise exception 'A source URL must use HTTP or HTTPS' using errcode = '23514';
  end if;
  if not exists (select 1 from public.people where tree_id = p_tree_id and id = p_person_id and archived_at is null) then
    raise exception 'Person is unavailable' using errcode = '42501';
  end if;
  insert into public.sources(tree_id, title, reference_url)
  values(p_tree_id, btrim(p_title), nullif(btrim(p_url), '')) returning id into source;
  insert into public.source_citations(tree_id, source_id, person_id, locator)
  values(p_tree_id, source, p_person_id, p_locator) returning id into citation;
  return citation;
end;
$$;

create function public.attach_person_photo(
  p_tree_id uuid, p_person_id uuid, p_path text, p_name text, p_content_type text, p_size integer
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  asset uuid;
begin
  if p_content_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') or not exists (
    select 1 from storage.objects where bucket_id = 'family-media' and name = p_path
    and metadata->>'mimetype' = p_content_type and metadata->>'size' = p_size::text
  ) then
    raise exception 'Private photograph is unavailable' using errcode = '23514';
  end if;
  insert into public.media_assets(tree_id, person_id, storage_path, display_name, content_type, size_bytes)
  values (p_tree_id, p_person_id, p_path, p_name, p_content_type, p_size)
  returning id into asset;
  update public.people set profile_photo_id = asset
  where id = p_person_id and tree_id = p_tree_id and archived_at is null;
  if not found then
    raise exception 'Person is unavailable' using errcode = '42501';
  end if;
  return asset;
end;
$$;

revoke all on function public.add_person_source(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.add_person_source(uuid, uuid, text, text, text) to authenticated;
revoke all on function public.attach_person_photo(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.attach_person_photo(uuid, uuid, text, text, text, integer) to authenticated;
