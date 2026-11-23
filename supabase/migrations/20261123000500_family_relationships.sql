create type public.partnership_status as enum ('unknown', 'current', 'former');
alter table public.partnerships
  add column status public.partnership_status not null default 'unknown';
update public.partnerships set status = 'former' where ended_on is not null;
alter table public.partnerships add constraint current_partnership_has_no_end
  check (status <> 'current' or ended_on is null);
alter table public.partnerships add constraint partnership_date_order_check check (
  started_on is null or ended_on is null or start_date_approximate or end_date_approximate
  or started_on <= case end_date_precision
    when 'year' then ended_on + interval '1 year' - interval '1 day'
    when 'month' then ended_on + interval '1 month' - interval '1 day'
    else ended_on::timestamp
  end
) not valid;

create table public.other_family_relationships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  person_a_id uuid not null,
  person_b_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 80),
  provenance public.relationship_provenance not null default 'user_reported',
  verification_status public.verification_status not null default 'unverified',
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tree_id, person_a_id) references public.people(tree_id, id) on delete cascade,
  foreign key (tree_id, person_b_id) references public.people(tree_id, id) on delete cascade,
  check (person_a_id < person_b_id),
  check (provenance <> 'ai_suggested' or verification_status <> 'verified')
);

create unique index other_family_relationships_unique_idx
  on public.other_family_relationships(tree_id, person_a_id, person_b_id, lower(btrim(label)));
create index other_family_relationships_person_b_idx
  on public.other_family_relationships(tree_id, person_b_id);

alter table public.other_family_relationships enable row level security;
revoke all on public.other_family_relationships from public, anon, authenticated;
grant select, insert, update, delete on public.other_family_relationships to authenticated;
create policy records_read_members on public.other_family_relationships for select to authenticated
  using (familyroots_private.current_tree_role(tree_id) is not null);
create policy records_insert_editors on public.other_family_relationships for insert to authenticated
  with check (familyroots_private.current_tree_role(tree_id) in ('owner', 'editor'));
create policy records_update_editors on public.other_family_relationships for update to authenticated
  using (familyroots_private.current_tree_role(tree_id) in ('owner', 'editor'))
  with check (familyroots_private.current_tree_role(tree_id) in ('owner', 'editor'));
create policy records_delete_editors on public.other_family_relationships for delete to authenticated
  using (familyroots_private.current_tree_role(tree_id) in ('owner', 'editor'));
create trigger set_write_metadata before insert or update on public.other_family_relationships
for each row execute function familyroots_private.set_write_metadata();
create trigger log_change after insert or update or delete on public.other_family_relationships
for each row execute function familyroots_private.log_change();

-- Serialize changes to a tree's directed links. Updating a row also forces
-- concurrent transactions with an older repeatable-read snapshot to retry.
create table familyroots_private.ancestry_write_guards (
  tree_id uuid primary key references public.family_trees(id) on delete cascade,
  revision bigint not null default 0
);
revoke all on familyroots_private.ancestry_write_guards from public, anon, authenticated;

create function familyroots_private.prevent_ancestry_cycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_tree uuid := case when tg_op = 'DELETE' then old.tree_id else new.tree_id end;
begin
  if tg_op = 'UPDATE' and new.tree_id is distinct from old.tree_id then
    raise exception 'Relationship cannot move between trees' using errcode = '23514';
  end if;

  if auth.uid() is not null and not coalesce(familyroots_private.current_tree_role(target_tree) in ('owner', 'editor'), false) then
    raise exception 'Tree editing permission is required' using errcode = '42501';
  end if;

  -- Cascade from deleting a tree has already removed the referenced row.
  if tg_op = 'DELETE' and not exists (select 1 from public.family_trees where id = target_tree) then
    return old;
  end if;
  insert into familyroots_private.ancestry_write_guards(tree_id)
    values (target_tree)
    on conflict (tree_id) do update set revision = familyroots_private.ancestry_write_guards.revision + 1;

  if tg_op = 'DELETE' then return old; end if;
  if exists (
    with recursive descendants(id) as (
      select new.child_id
      union
      select r.child_id
      from descendants d join public.parent_child_relationships r on r.parent_id = d.id
      where r.tree_id = target_tree and r.id <> new.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'Ancestry cycle' using errcode = '23514', constraint = 'ancestry_cycle';
  end if;
  return new;
end;
$$;
revoke all on function familyroots_private.prevent_ancestry_cycle() from public, anon, authenticated;
create trigger prevent_ancestry_cycle before insert or update or delete on public.parent_child_relationships
for each row execute function familyroots_private.prevent_ancestry_cycle();

create function public.save_family_connection(
  p_tree_id uuid, p_person_id uuid, p_connection jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  target_id uuid := nullif(p_connection->>'targetId', '')::uuid;
  connection_id uuid := nullif(p_connection->>'id', '')::uuid;
  new_name text := nullif(btrim(p_connection->>'newName'), '');
  category text := p_connection->>'category';
  connection_kind text := p_connection->>'kind';
  direction text := p_connection->>'direction';
  provenance_value public.relationship_provenance :=
    case when p_connection->>'provenance' = 'documented' then 'documented'::public.relationship_provenance
      else 'user_reported'::public.relationship_provenance end;
  connection_notes text := nullif(btrim(p_connection->>'notes'), '');
  start_date date := nullif(p_connection->>'startedOn', '')::date;
  end_date date := nullif(p_connection->>'endedOn', '')::date;
  first_id uuid;
  second_id uuid;
  saved_id uuid;
begin
  if not coalesce(familyroots_private.current_tree_role(p_tree_id) in ('owner', 'editor'), false) then
    raise exception 'Tree editing permission is required' using errcode = '42501';
  end if;
  if num_nonnulls(target_id, new_name) <> 1 or (connection_id is not null and target_id is null)
    or coalesce(length(connection_notes), 0) > 2000 then
    raise exception 'Invalid connection details' using errcode = '23514';
  end if;
  if not exists (select 1 from public.people where id = p_person_id and tree_id = p_tree_id and archived_at is null) then
    raise exception 'Person is unavailable' using errcode = '42501';
  end if;

  if new_name is not null then
    insert into public.people (tree_id, display_name) values (p_tree_id, new_name)
    returning id into target_id;
  elsif not exists (
    select 1 from public.people where id = target_id and tree_id = p_tree_id
    and (archived_at is null or connection_id is not null)
  ) then
    raise exception 'Relative is unavailable' using errcode = '42501';
  end if;
  if p_person_id = target_id then
    raise exception 'Select two different people' using errcode = '23514';
  end if;

  first_id := least(p_person_id, target_id);
  second_id := greatest(p_person_id, target_id);

  if category = 'parent' then
    if direction is null or direction not in ('parent', 'child') then
      raise exception 'Parent-child direction is required' using errcode = '23514';
    end if;
    first_id := case when direction = 'parent' then target_id else p_person_id end;
    second_id := case when direction = 'parent' then p_person_id else target_id end;
    if connection_id is null then
      insert into public.parent_child_relationships(tree_id, parent_id, child_id, kind, provenance, notes)
        values (p_tree_id, first_id, second_id, connection_kind::public.parent_child_kind, provenance_value, connection_notes)
        returning id into saved_id;
    else
      update public.parent_child_relationships set parent_id = first_id, child_id = second_id,
        kind = connection_kind::public.parent_child_kind, notes = connection_notes
        where id = connection_id and tree_id = p_tree_id
        and least(parent_id, child_id) = least(first_id, second_id) and greatest(parent_id, child_id) = greatest(first_id, second_id)
        returning id into saved_id;
    end if;
  elsif category = 'partnership' then
    if connection_id is null then
      insert into public.partnerships(tree_id, person_a_id, person_b_id, kind, status, provenance, notes,
        started_on, start_date_precision, start_date_approximate, ended_on, end_date_precision, end_date_approximate)
      values (p_tree_id, first_id, second_id, connection_kind::public.partnership_kind,
        (p_connection->>'status')::public.partnership_status, provenance_value, connection_notes,
        start_date, coalesce(p_connection->>'startPrecision', 'unknown')::public.date_precision,
        coalesce((p_connection->>'startApproximate')::boolean, false),
        end_date, coalesce(p_connection->>'endPrecision', 'unknown')::public.date_precision,
        coalesce((p_connection->>'endApproximate')::boolean, false)) returning id into saved_id;
    else
      update public.partnerships set kind = connection_kind::public.partnership_kind,
        status = (p_connection->>'status')::public.partnership_status, notes = connection_notes,
        started_on = start_date, start_date_precision = coalesce(p_connection->>'startPrecision', 'unknown')::public.date_precision,
        start_date_approximate = coalesce((p_connection->>'startApproximate')::boolean, false),
        ended_on = end_date, end_date_precision = coalesce(p_connection->>'endPrecision', 'unknown')::public.date_precision,
        end_date_approximate = coalesce((p_connection->>'endApproximate')::boolean, false)
      where id = connection_id and tree_id = p_tree_id and person_a_id = first_id and person_b_id = second_id
      returning id into saved_id;
    end if;
  elsif category = 'other' then
    if connection_id is null then
      insert into public.other_family_relationships(tree_id, person_a_id, person_b_id, label, provenance, notes)
      values (p_tree_id, first_id, second_id, btrim(connection_kind), provenance_value, connection_notes) returning id into saved_id;
    else
      update public.other_family_relationships set label = btrim(connection_kind), notes = connection_notes
      where id = connection_id and tree_id = p_tree_id and person_a_id = first_id and person_b_id = second_id
      returning id into saved_id;
    end if;
  else
    raise exception 'Choose a relationship category' using errcode = '23514';
  end if;

  if saved_id is null then
    raise exception 'Connection is unavailable' using errcode = '42501';
  end if;
  return saved_id;
end;
$$;
revoke all on function public.save_family_connection(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_family_connection(uuid, uuid, jsonb) to authenticated;
