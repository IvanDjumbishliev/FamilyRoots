alter table public.life_events
  add column entry_kind text not null default 'family' check (entry_kind in ('family','context')),
  add column verification_status public.verification_status not null default 'unverified',
  add constraint life_events_context_not_family_verification
    check (entry_kind = 'family' or verification_status = 'unverified');

create table public.life_event_people (
  tree_id uuid not null,
  event_id uuid not null,
  person_id uuid not null,
  primary key (event_id, person_id),
  foreign key (tree_id, event_id) references public.life_events(tree_id, id) on delete cascade,
  foreign key (tree_id, person_id) references public.people(tree_id, id) on delete cascade
);
create index life_event_people_person_idx on public.life_event_people(tree_id, person_id);

insert into public.life_event_people(tree_id,event_id,person_id)
select tree_id,id,person_id from public.life_events where person_id is not null;

create table public.life_event_archive_items (
  tree_id uuid not null,
  event_id uuid not null,
  item_id uuid not null,
  primary key (event_id, item_id),
  foreign key (tree_id, event_id) references public.life_events(tree_id, id) on delete cascade,
  foreign key (tree_id, item_id) references public.archive_items(tree_id, id) on delete cascade
);
create index life_event_archive_items_item_idx on public.life_event_archive_items(tree_id,item_id);

alter table public.life_event_people enable row level security;
alter table public.life_event_archive_items enable row level security;
revoke all on public.life_event_people,public.life_event_archive_items from public, anon, authenticated;
grant select, insert, delete on public.life_event_people,public.life_event_archive_items to authenticated;

create policy timeline_people_read on public.life_event_people for select to authenticated
  using (familyroots_private.current_tree_role(tree_id) is not null);
create policy timeline_people_add on public.life_event_people for insert to authenticated
  with check (familyroots_private.current_tree_role(tree_id) in ('owner','editor'));
create policy timeline_people_remove on public.life_event_people for delete to authenticated
  using (familyroots_private.current_tree_role(tree_id) in ('owner','editor'));

create policy timeline_archive_read on public.life_event_archive_items for select to authenticated
  using (familyroots_private.current_tree_role(tree_id) is not null and exists (
    select 1 from public.archive_items a where a.tree_id = life_event_archive_items.tree_id and a.id = item_id
  ));
create policy timeline_archive_add on public.life_event_archive_items for insert to authenticated
  with check (familyroots_private.current_tree_role(tree_id) in ('owner','editor') and exists (
    select 1 from public.archive_items a where a.tree_id = life_event_archive_items.tree_id and a.id = item_id
  ));
create policy timeline_archive_remove on public.life_event_archive_items for delete to authenticated
  using (familyroots_private.current_tree_role(tree_id) in ('owner','editor'));

create function familyroots_private.sync_legacy_event_person()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.person_id is not null then
    insert into public.life_event_people(tree_id,event_id,person_id)
    values(new.tree_id,new.id,new.person_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function familyroots_private.sync_legacy_event_person() from public, anon, authenticated;
create trigger sync_legacy_event_person after insert or update of person_id on public.life_events
for each row execute function familyroots_private.sync_legacy_event_person();

create function public.save_timeline_event(p_tree uuid, p_payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  current_id uuid := nullif(p_payload->>'id','')::uuid;
  expected timestamptz := nullif(p_payload->>'version','')::timestamptz;
  date_value date := nullif(p_payload->>'date','')::date;
  precision_value public.date_precision := (p_payload->>'precision')::public.date_precision;
  approximate_value boolean := coalesce((p_payload->>'approximate')::boolean,false);
  event_title text := btrim(p_payload->>'title');
  kind text := p_payload->>'kind';
  event_kind text := p_payload->>'type';
  place_value text := nullif(btrim(p_payload->>'place'),'');
  description_value text := nullif(btrim(p_payload->>'notes'),'');
  verification_value public.verification_status := (p_payload->>'verification')::public.verification_status;
  linked_people uuid[];
  linked_items uuid[];
  linked_sources uuid[];
  saved_id uuid;
begin
  if not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
    raise exception 'Timeline editing permission required' using errcode = '42501';
  end if;
  if event_title is null or length(event_title) not between 1 and 160
    or kind is null or kind not in ('family','context')
    or event_kind is null or event_kind not in ('birth','partnership','death','migration','education','occupation','military_service','residence','custom')
    or coalesce(length(place_value),0) > 240 or coalesce(length(description_value),0) > 6000
    or verification_value is null or (kind = 'context' and verification_value <> 'unverified')
    or precision_value is null or ((date_value is null) <> (precision_value = 'unknown'))
    or (date_value is null and approximate_value)
    or (precision_value = 'year' and extract(month from date_value) <> 1)
    or (precision_value in ('year','month') and extract(day from date_value) <> 1) then
    raise exception 'Invalid timeline event details' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct value::uuid),'{}') into linked_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  select coalesce(array_agg(distinct value::uuid),'{}') into linked_items from jsonb_array_elements_text(coalesce(p_payload->'items','[]'));
  select coalesce(array_agg(distinct value::uuid),'{}') into linked_sources from jsonb_array_elements_text(coalesce(p_payload->'sources','[]'));
  if cardinality(linked_people) > 100 or cardinality(linked_items) > 100 or cardinality(linked_sources) > 100 then
    raise exception 'Too many linked records' using errcode = '23514';
  end if;

  if current_id is null then
    insert into public.life_events(tree_id,title,event_type,entry_kind,verification_status,occurred_on,date_precision,date_approximate,place,notes)
    values(p_tree,event_title,event_kind,kind,verification_value,date_value,precision_value,approximate_value,place_value,description_value)
    returning id into saved_id;
  else
    update public.life_events set title = event_title, event_type = event_kind, entry_kind = kind, verification_status = verification_value,
      occurred_on = date_value, date_precision = precision_value, date_approximate = approximate_value,
      place = place_value, notes = description_value, person_id = null
    where id = current_id and tree_id = p_tree and updated_at = expected
    returning id into saved_id;
    if saved_id is null then raise exception 'Timeline event changed or is unavailable' using errcode = 'P0002'; end if;
  end if;

  delete from public.life_event_people where event_id = saved_id and tree_id = p_tree and not (person_id = any(linked_people));
  insert into public.life_event_people(tree_id,event_id,person_id)
    select p_tree,saved_id,person from unnest(linked_people) as person
    on conflict do nothing;
  delete from public.life_event_archive_items where event_id = saved_id and tree_id = p_tree and not (item_id = any(linked_items));
  insert into public.life_event_archive_items(tree_id,event_id,item_id)
    select p_tree,saved_id,item from unnest(linked_items) as item
    on conflict do nothing;
  delete from public.source_citations where life_event_id = saved_id and tree_id = p_tree and not (source_id = any(linked_sources));
  insert into public.source_citations(tree_id,source_id,life_event_id)
    select p_tree,source,saved_id from unnest(linked_sources) as source
    where not exists (select 1 from public.source_citations c where c.tree_id = p_tree and c.life_event_id = saved_id and c.source_id = source);
  return saved_id;
end;
$$;

revoke all on function public.save_timeline_event(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_timeline_event(uuid,jsonb) to authenticated;
