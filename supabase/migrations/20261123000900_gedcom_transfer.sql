create function familyroots_private.import_gedcom_citations(
  p_tree uuid, p_sources jsonb, p_citations jsonb, p_person uuid default null,
  p_parent uuid default null, p_partner uuid default null, p_event uuid default null
) returns void language sql set search_path='' as $$
  insert into public.source_citations(tree_id,source_id,person_id,relationship_id,partnership_id,life_event_id,locator,notes)
  select distinct p_tree,m.source_id,p_person,p_parent,p_partner,p_event,nullif(c->>'page',''),nullif(c->>'notes','')
  from jsonb_array_elements(p_citations) c
  cross join lateral (select (p_sources->>(c->>'source'))::uuid as source_id) m
  where m.source_id is not null and not exists (
    select 1 from public.source_citations s where s.tree_id=p_tree and s.source_id=m.source_id
      and s.person_id is not distinct from p_person and s.relationship_id is not distinct from p_parent
      and s.partnership_id is not distinct from p_partner and s.life_event_id is not distinct from p_event
      and s.locator is not distinct from nullif(c->>'page','') and s.notes is not distinct from nullif(c->>'notes','')
  );
$$;
revoke all on function familyroots_private.import_gedcom_citations(uuid,jsonb,jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;

create table familyroots_private.gedcom_import_receipts (
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  payload_hash bytea not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(tree_id,actor_id,request_id)
);
alter table familyroots_private.gedcom_import_receipts enable row level security;
revoke all on familyroots_private.gedcom_import_receipts from public,anon,authenticated;

create function public.import_gedcom(p_tree uuid,p_data jsonb,p_choices jsonb,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  people jsonb := '{}'::jsonb; sources jsonb := '{}'::jsonb;
  item jsonb; decision text; ref text; target uuid; a uuid; b uuid; temporary_id uuid;
  existing public.people%rowtype; participants uuid[]; day date;
  parent_kind public.parent_child_kind; partner_kind public.partnership_kind;
  step text := 'file'; item_number integer := 0;
  created integer := 0; merged integer := 0; skipped integer := 0;
  connections integer := 0; events integer := 0; source_count integer := 0; kept integer := 0;
  failure text; detail text;
  receipt familyroots_private.gedcom_import_receipts%rowtype; payload_hash bytea; result jsonb;
begin
  if not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
    raise exception 'Tree editing permission is required' using errcode='42501';
  end if;
  perform 1 from public.family_trees where id=p_tree for update;
  if not found or not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
    raise exception 'Tree editing permission is required' using errcode='42501';
  end if;
  if p_data is null or p_choices is null or octet_length(p_data::text)>4194304
    or octet_length(p_choices::text)>65536 or jsonb_typeof(p_choices)<>'object'
    or jsonb_array_length(p_data->'people') not between 1 and 500
    or (jsonb_array_length(p_data->'parents')+jsonb_array_length(p_data->'partners')+
        jsonb_array_length(p_data->'events')+jsonb_array_length(p_data->'sources'))>4000
    or not (p_data ?& array['people','parents','partners','events','sources']) then
    raise exception 'Import payload exceeds the limits or is incomplete' using errcode='22023';
  end if;

  if p_request is not null then
    payload_hash:=sha256(convert_to(p_data::text || ' ' || p_choices::text,'UTF8'));
    select * into receipt from familyroots_private.gedcom_import_receipts
      where tree_id=p_tree and actor_id=auth.uid() and request_id=p_request;
    if found then
      if payload_hash<>receipt.payload_hash then
        raise exception 'A different import already used this request identifier' using errcode='22023';
      end if;
      return receipt.result;
    end if;
  end if;

  -- The exception block is a subtransaction. A failed record rolls back the entire batch.
  begin
    step := 'source';
    for item in select value from jsonb_array_elements(p_data->'sources') loop
      item_number:=item_number+1;
      ref:=item->>'ref';
      if ref is null or sources ? ref then raise exception 'Duplicate or missing source reference' using errcode='22023'; end if;
      select id into target from public.sources where tree_id=p_tree and title=item->>'title'
        and reference_url is not distinct from (case when item->>'url' ~ '^https?://[^[:space:]]+$' then item->>'url' end)
        and rights_note is not distinct from nullif(item->>'notes','') order by id limit 1;
      if not found then
        insert into public.sources(tree_id,title,reference_url,rights_note) values
          (p_tree,item->>'title',case when item->>'url' ~ '^https?://[^[:space:]]+$' then item->>'url' end,nullif(item->>'notes',''))
        returning id into target;
        source_count:=source_count+1;
      else skipped:=skipped+1;
      end if;
      sources:=sources || jsonb_build_object(ref,target);
    end loop;

    step := 'person'; item_number:=0;
    for item in select value from jsonb_array_elements(p_data->'people') loop
      item_number:=item_number+1;
      ref:=item->>'ref';
      if ref is null or people ? ref then raise exception 'Duplicate or missing person reference' using errcode='22023'; end if;
      decision:=p_choices->>ref;
      if decision='skip' then
        people:=people || jsonb_build_object(ref,null);
        skipped:=skipped+1;
        continue;
      elsif left(decision,5)='same:' then
        target:=(people->>substr(decision,6))::uuid;
        if target is null then raise exception 'Choose an earlier imported person who is not skipped' using errcode='22023'; end if;
        decision:=target::text;
      end if;
      if decision='create' then
        insert into public.people(tree_id,display_name,given_names,surnames,alternative_names,living_status,birth_date,birth_date_precision,
          birth_date_approximate,death_date,death_date_precision,death_date_approximate,birth_place,death_place,notes,biography)
        values(p_tree,item->>'name',nullif(item->>'given',''),nullif(item->>'surname',''),
          array(select jsonb_array_elements_text(item->'aliases')),(item->>'status')::public.living_status,
          (item->'birth'->>'date')::date,(item->'birth'->>'precision')::public.date_precision,(item->'birth'->>'approximate')::boolean,
          (item->'death'->>'date')::date,(item->'death'->>'precision')::public.date_precision,(item->'death'->>'approximate')::boolean,
          nullif(item->>'birthPlace',''),nullif(item->>'deathPlace',''),nullif(item->>'notes',''),nullif(item->>'biography',''))
        returning id into target;
        created:=created+1;
      elsif decision is not null then
        select * into existing from public.people where tree_id=p_tree and id=decision::uuid and archived_at is null and not is_draft for update;
        if not found then raise exception 'Merge target is unavailable in this tree' using errcode='22023'; end if;
        target:=existing.id;
        if (item->>'name' is distinct from existing.display_name
          or (existing.given_names is not null and nullif(item->>'given','') not in (existing.given_names))
          or (existing.surnames is not null and nullif(item->>'surname','') not in (existing.surnames))
          or (existing.biography is not null and nullif(item->>'biography','') not in (existing.biography))
          or (existing.notes is not null and nullif(item->>'notes','') not in (existing.notes))
          or (existing.birth_place is not null and nullif(item->>'birthPlace','') not in (existing.birth_place))
          or (existing.death_place is not null and nullif(item->>'deathPlace','') not in (existing.death_place))
          or (existing.living_status<>'unknown' and item->>'status'<>'unknown' and existing.living_status::text<>item->>'status')
          or (existing.birth_date is not null and existing.birth_date<>(item->'birth'->>'date')::date)
          or (existing.death_date is not null and existing.death_date<>(item->'death'->>'date')::date)) then kept:=kept+1;
        end if;
        update public.people set
          given_names=coalesce(given_names,nullif(item->>'given','')), surnames=coalesce(surnames,nullif(item->>'surname','')),
          biography=coalesce(biography,nullif(item->>'biography','')),
          birth_place=coalesce(birth_place,nullif(item->>'birthPlace','')), notes=coalesce(notes,nullif(item->>'notes','')),
          alternative_names=array(select distinct alias from unnest(existing.alternative_names ||
            array(select jsonb_array_elements_text(item->'aliases'))) alias order by alias limit 20),
          living_status=case when existing.living_status='unknown' and (item->>'status'<>'living' or existing.death_date is null and existing.death_place is null)
            then (item->>'status')::public.living_status else existing.living_status end,
          birth_date=coalesce(existing.birth_date,(item->'birth'->>'date')::date),
          birth_date_precision=case when existing.birth_date is null then (item->'birth'->>'precision')::public.date_precision else existing.birth_date_precision end,
          birth_date_approximate=case when existing.birth_date is null then (item->'birth'->>'approximate')::boolean else existing.birth_date_approximate end,
          death_place=case when existing.living_status='living' then null else coalesce(death_place,nullif(item->>'deathPlace','')) end,
          death_date=case when existing.living_status='living' then null else coalesce(existing.death_date,(item->'death'->>'date')::date) end,
          death_date_precision=case when existing.living_status='living' or existing.death_date is not null then existing.death_date_precision else (item->'death'->>'precision')::public.date_precision end,
          death_date_approximate=case when existing.living_status='living' or existing.death_date is not null then existing.death_date_approximate else (item->'death'->>'approximate')::boolean end
        where id=target;
        merged:=merged+1;
      else
        raise exception 'Every person needs a create, merge or skip decision' using errcode='22023';
      end if;
      people:=people || jsonb_build_object(ref,target);
      perform familyroots_private.import_gedcom_citations(p_tree,sources,item->'citations',p_person=>target);
    end loop;

    step := 'parent link'; item_number:=0;
    for item in select value from jsonb_array_elements(p_data->'parents') loop
      item_number:=item_number+1;
      if not (people ? (item->>'parent') and people ? (item->>'child')) then
        raise exception 'Parent link points outside the import' using errcode='22023';
      end if;
      a:=(people->>(item->>'parent'))::uuid; b:=(people->>(item->>'child'))::uuid;
      if a is null or b is null then skipped:=skipped+1; continue; end if;
      if a=b then raise exception 'A person cannot be their own parent. Review merge choices.' using errcode='22023'; end if;
      parent_kind:=(item->>'kind')::public.parent_child_kind;
      select id into target from public.parent_child_relationships where tree_id=p_tree and parent_id=a and child_id=b
        and parent_child_relationships.kind=parent_kind;
      if not found then
        insert into public.parent_child_relationships(tree_id,parent_id,child_id,kind,provenance,notes)
        values (p_tree,a,b,parent_kind,'imported',nullif(item->>'notes',''))
        on conflict (tree_id,parent_id,child_id,kind) do nothing returning id into target;
        if target is not null then connections:=connections+1;
        else
          select id into target from public.parent_child_relationships where tree_id=p_tree and parent_id=a and child_id=b
            and parent_child_relationships.kind=parent_kind;
          skipped:=skipped+1;
        end if;
      else skipped:=skipped+1;
      end if;
      perform familyroots_private.import_gedcom_citations(p_tree,sources,item->'citations',p_parent=>target);
    end loop;

    step := 'partnership'; item_number:=0;
    for item in select value from jsonb_array_elements(p_data->'partners') loop
      item_number:=item_number+1;
      if not (people ? (item->>'a') and people ? (item->>'b')) then raise exception 'Partner points outside the import' using errcode='22023'; end if;
      a:=(people->>(item->>'a'))::uuid; b:=(people->>(item->>'b'))::uuid;
      if a is null or b is null then skipped:=skipped+1; continue; end if;
      if a=b then raise exception 'A person cannot be their own partner. Review merge choices.' using errcode='22023'; end if;
      if a>b then temporary_id:=a; a:=b; b:=temporary_id; end if;
      partner_kind:=(item->>'kind')::public.partnership_kind;
      select id into target from public.partnerships where tree_id=p_tree and person_a_id=a and person_b_id=b and partnerships.kind=partner_kind
        and started_on is not distinct from (item->'start'->>'date')::date
        and ended_on is not distinct from (item->'end'->>'date')::date order by id limit 1;
      if not found then
        insert into public.partnerships(tree_id,person_a_id,person_b_id,kind,provenance,status,started_on,start_date_precision,start_date_approximate,
          ended_on,end_date_precision,end_date_approximate,notes)
        values(p_tree,a,b,partner_kind,'imported',(item->>'status')::public.partnership_status,
          (item->'start'->>'date')::date,(item->'start'->>'precision')::public.date_precision,(item->'start'->>'approximate')::boolean,
          (item->'end'->>'date')::date,(item->'end'->>'precision')::public.date_precision,(item->'end'->>'approximate')::boolean,
          nullif(item->>'notes','')) returning id into target;
        connections:=connections+1;
      else skipped:=skipped+1;
      end if;
      perform familyroots_private.import_gedcom_citations(p_tree,sources,item->'citations',p_partner=>target);
    end loop;

    step := 'event'; item_number:=0;
    for item in select value from jsonb_array_elements(p_data->'events') loop
      item_number:=item_number+1;
      if exists(select 1 from jsonb_array_elements_text(item->'people') participant where not (people ? participant)) then
        raise exception 'Event participant points outside the import' using errcode='22023';
      end if;
      select array_agg(distinct id order by id) into participants from (
        select (people->>participant)::uuid id from jsonb_array_elements_text(item->'people') participant
      ) ids where id is not null;
      if participants is null then skipped:=skipped+1; continue; end if;
      day:=(item->'when'->>'date')::date;
      select e.id into target from public.life_events e where e.tree_id=p_tree and e.entry_kind='family'
        and e.title=item->>'title' and e.event_type=item->>'type' and e.occurred_on is not distinct from day
        and e.date_precision::text=item->'when'->>'precision' and e.date_approximate=(item->'when'->>'approximate')::boolean
        and e.place is not distinct from nullif(item->>'place','') and e.notes is not distinct from nullif(item->>'notes','')
        and participants=array(select l.person_id from public.life_event_people l where l.event_id=e.id order by l.person_id)
        order by e.id limit 1;
      if not found then
        insert into public.life_events(tree_id,title,event_type,occurred_on,date_precision,date_approximate,place,notes)
        values(p_tree,item->>'title',item->>'type',day,(item->'when'->>'precision')::public.date_precision,
          (item->'when'->>'approximate')::boolean,nullif(item->>'place',''),nullif(item->>'notes','')) returning id into target;
        insert into public.life_event_people(tree_id,event_id,person_id) select p_tree,target,unnest(participants);
        events:=events+1;
      else skipped:=skipped+1;
      end if;
      perform familyroots_private.import_gedcom_citations(p_tree,sources,item->'citations',p_event=>target);
    end loop;
  exception
    when data_exception or integrity_constraint_violation then
      get stacked diagnostics failure=message_text, detail=constraint_name;
      return jsonb_build_object('created',0,'merged',0,'relationships',0,'events',0,'sources',0,
        'skipped',0,'kept',0,'failed',1,'error',format('%s %s: %s',initcap(step),item_number,
          case when detail='ancestry_cycle' then 'This would create an ancestry cycle.'
            when sqlstate='22023' then failure
            else 'A field or date conflicts with the tree’s data rules. Review this record and its merge choice.' end));
  end;
  result:=jsonb_build_object('created',created,'merged',merged,'relationships',connections,'events',events,
    'sources',source_count,'skipped',skipped,'kept',kept,'failed',0);
  if p_request is not null then
    insert into familyroots_private.gedcom_import_receipts(tree_id,actor_id,request_id,payload_hash,result)
    values (p_tree,auth.uid(),p_request,payload_hash,result);
  end if;
  return result;
end;
$$;
revoke all on function public.import_gedcom(uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.import_gedcom(uuid,jsonb,jsonb,uuid) to authenticated;

create function familyroots_private.gedcom_date(p_day date,p_precision public.date_precision,p_approximate boolean)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('date',p_day,'precision',p_precision,'approximate',p_approximate);
$$;

create function familyroots_private.gedcom_citations(
  p_tree uuid,p_person uuid default null,p_parent uuid default null,p_partner uuid default null,p_event uuid default null
) returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('source',source_id,'page',coalesce(locator,''),'notes',coalesce(notes,'')) order by id),'[]'::jsonb)
  from public.source_citations where tree_id=p_tree and
    (person_id=p_person or relationship_id=p_parent or partnership_id=p_partner or life_event_id=p_event);
$$;
revoke all on function familyroots_private.gedcom_date(date,public.date_precision,boolean),
  familyroots_private.gedcom_citations(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;

create function public.export_gedcom(p_tree uuid,p_exclude_living boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare output jsonb;
begin
  if not coalesce(familyroots_private.current_tree_role(p_tree)='owner',false) then
    raise exception 'Only the tree owner can export it' using errcode='42501';
  end if;
  if p_exclude_living is null then raise exception 'Choose an export privacy setting' using errcode='22023'; end if;
  if (select count(*) from public.people where tree_id=p_tree and archived_at is null and not is_draft
    and (not p_exclude_living or living_status='deceased')) > 500 then
    raise exception 'The GEDCOM export limit is 500 included people' using errcode='22023';
  end if;
  with included as materialized (
    select * from public.people where tree_id=p_tree and archived_at is null and not is_draft
      and (not p_exclude_living or living_status='deceased')
  ), included_events as (
    select e.*,array(select l.person_id from public.life_event_people l where l.event_id=e.id order by l.person_id) as people
    from public.life_events e where e.tree_id=p_tree and e.entry_kind='family'
      and not p_exclude_living
      and exists(select 1 from public.life_event_people l where l.event_id=e.id)
      and not exists(select 1 from public.life_event_people l where l.event_id=e.id
        and not exists(select 1 from included p where p.id=l.person_id))
  )
  select jsonb_build_object(
    'people', (select coalesce(jsonb_agg(jsonb_build_object(
      'ref',p.id,'name',p.display_name,'given',coalesce(p.given_names,''),'surname',coalesce(p.surnames,''),
      'aliases',case when p_exclude_living then '{}'::text[] else p.alternative_names end,'status',p.living_status,
      'birth',familyroots_private.gedcom_date(p.birth_date,p.birth_date_precision,p.birth_date_approximate),
      'death',familyroots_private.gedcom_date(p.death_date,p.death_date_precision,p.death_date_approximate),
      'birthPlace',case when p_exclude_living then '' else coalesce(p.birth_place,'') end,
      'deathPlace',case when p_exclude_living then '' else coalesce(p.death_place,'') end,
      'notes',case when p_exclude_living then '' else coalesce(p.notes,'') end,
      'biography',case when p_exclude_living then '' else coalesce(p.biography,'') end,
      'citations',case when p_exclude_living then '[]'::jsonb else familyroots_private.gedcom_citations(p_tree,p_person=>p.id) end
    ) order by p.id),'[]'::jsonb) from included p),
    'parents', (select coalesce(jsonb_agg(jsonb_build_object(
      'parent',r.parent_id,'child',r.child_id,'kind',r.kind,
      'notes',case when p_exclude_living then '' else coalesce(r.notes,'') end,
      'citations',case when p_exclude_living then '[]'::jsonb else familyroots_private.gedcom_citations(p_tree,p_parent=>r.id) end
    ) order by r.id),'[]'::jsonb)
    from public.parent_child_relationships r
    join included a on r.parent_id=a.id join included b on r.child_id=b.id
    where r.tree_id=p_tree and r.verification_status<>'disputed' and r.provenance<>'ai_suggested'),
    'partners', (select coalesce(jsonb_agg(jsonb_build_object(
      'a',r.person_a_id,'b',r.person_b_id,'kind',r.kind,'status',r.status,
      'start',familyroots_private.gedcom_date(r.started_on,r.start_date_precision,r.start_date_approximate),
      'end',familyroots_private.gedcom_date(r.ended_on,r.end_date_precision,r.end_date_approximate),
      'notes',case when p_exclude_living then '' else coalesce(r.notes,'') end,
      'citations',case when p_exclude_living then '[]'::jsonb else familyroots_private.gedcom_citations(p_tree,p_partner=>r.id) end
    ) order by r.id),'[]'::jsonb)
    from public.partnerships r join included a on r.person_a_id=a.id join included b on r.person_b_id=b.id
    where r.tree_id=p_tree and r.verification_status<>'disputed' and r.provenance<>'ai_suggested'),
    'events',(select coalesce(jsonb_agg(jsonb_build_object(
      'people',e.people,'type',e.event_type,'title',e.title,'place',coalesce(e.place,''),'notes',coalesce(e.notes,''),
      'when',familyroots_private.gedcom_date(e.occurred_on,e.date_precision,e.date_approximate),
      'citations',familyroots_private.gedcom_citations(p_tree,p_event=>e.id)
    ) order by e.id),'[]'::jsonb) from included_events e),
    'sources',(select coalesce(jsonb_agg(jsonb_build_object(
      'ref',s.id,'title',s.title,'url',coalesce(s.reference_url,''),'notes',coalesce(s.rights_note,'')
    ) order by s.id),'[]'::jsonb) from public.sources s where s.tree_id=p_tree and not p_exclude_living)
  ) into output;
  if octet_length(output::text)>4194304 then
    raise exception 'The tree exceeds the GEDCOM export size limit' using errcode='22023';
  end if;
  return output;
end;
$$;
revoke all on function public.export_gedcom(uuid,boolean) from public,anon,authenticated;
grant execute on function public.export_gedcom(uuid,boolean) to authenticated;
