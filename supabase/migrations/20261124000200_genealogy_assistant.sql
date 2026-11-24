create table familyroots_private.assistant_limits (
  bucket text primary key,
  window_start date not null,
  used integer not null check (used > 0)
);
alter table familyroots_private.assistant_limits enable row level security;
revoke all on familyroots_private.assistant_limits from public,anon,authenticated;

-- Only the protected function may reserve model calls. Keys contain no family content.
create function public.reserve_assistant_request(p_actor uuid,p_live boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare day_start date:=(clock_timestamp() at time zone 'UTC')::date; current_count integer;
begin
  if p_actor is null or p_live is null or not exists(select 1 from public.profiles where id=p_actor) then return false; end if;
  if p_live then
    insert into familyroots_private.assistant_limits as l values('live',day_start,1)
    on conflict(bucket) do update set window_start=excluded.window_start,
      used=case when l.window_start=excluded.window_start then l.used+1 else 1 end
    where l.window_start<>excluded.window_start or l.used<200
    returning used into current_count;
  else
    insert into familyroots_private.assistant_limits as l values('account:'||p_actor,day_start,1)
    on conflict(bucket) do update set window_start=excluded.window_start,
      used=case when l.window_start=excluded.window_start then l.used+1 else 1 end
    where l.window_start<>excluded.window_start or l.used<20
    returning used into current_count;
  end if;
  return current_count is not null;
end;
$$;
revoke all on function public.reserve_assistant_request(uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_assistant_request(uuid,boolean) to service_role;

create function public.get_assistant_evidence(p_tree uuid,p_people uuid[],p_task text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare selected uuid[]:=coalesce(p_people,'{}');
begin
  if familyroots_private.current_tree_role(p_tree) is null then
    raise exception 'Tree membership required' using errcode='42501';
  end if;
  if cardinality(selected)>2
    or p_task is null or p_task not in ('summary','questions','gaps','document','matches','interview','biography','relationship','plan')
    or (p_task='relationship' and (cardinality(selected)<>2 or selected[1]=selected[2]))
    or (p_task in ('gaps','biography','matches') and cardinality(selected)<>1) then
    raise exception 'Choose the required profiles' using errcode='22023';
  end if;
  if exists(select 1 from unnest(selected) s(id) where not exists(select 1 from public.people p
    where p.tree_id=p_tree and p.id=s.id and p.archived_at is null and not p.is_draft)) then
    raise exception 'Selected profile is unavailable' using errcode='42501';
  end if;
  return jsonb_build_object(
    'people', (select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.display_name,'status',p.verification_status,
      'birth',p.birth_date,'birthPrecision',p.birth_date_precision,'birthApproximate',p.birth_date_approximate,
      'death',p.death_date,'deathPrecision',p.death_date_precision,'deathApproximate',p.death_date_approximate,
      'birthPlace',left(p.birth_place,240),'deathPlace',left(p.death_place,240),'occupation',left(p.occupation,160)
    ) order by array_position(selected,p.id)),'[]'::jsonb)
      from (select * from public.people where tree_id=p_tree and archived_at is null and not is_draft
        and (id=any(selected) or (cardinality(selected)=0 and p_task='summary' and verification_status='verified'))
        order by display_name,id limit 5) p),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'title',e.title,'day',e.occurred_on,'precision',e.date_precision,'approximate',e.date_approximate
    ) order by e.occurred_on nulls last,e.id),'[]'::jsonb) from (
      select e.* from public.life_events e
      where e.tree_id=p_tree and e.verification_status='verified' and e.entry_kind='family'
        and p_task in ('summary','biography') and exists(select 1 from public.life_event_people ep
          where ep.tree_id=p_tree and ep.event_id=e.id and ep.person_id=any(selected))
      order by e.occurred_on nulls last,e.id limit 10
    ) e),
    'edges', (select coalesce(jsonb_agg(links),'[]'::jsonb) from (
      select kind,a,b,id,verified,relation from (
        select r.kind::text kind,r.parent_id a,r.child_id b,r.id,r.verification_status='verified' verified,'parent' relation
        from public.parent_child_relationships r where r.tree_id=p_tree and r.verification_status<>'disputed' and r.provenance<>'ai_suggested'
        union all select r.kind::text,r.person_a_id,r.person_b_id,r.id,r.verification_status='verified','partner'
        from public.partnerships r where r.tree_id=p_tree and r.verification_status<>'disputed' and r.provenance<>'ai_suggested'
      ) available
      where p_task='relationship' and exists(select 1 from public.people p where p.id=available.a and p.archived_at is null and not p.is_draft)
        and exists(select 1 from public.people p where p.id=available.b and p.archived_at is null and not p.is_draft)
      order by verified desc,id limit 601
    ) links),
    'edgeNames', (select coalesce(jsonb_object_agg(p.id,p.display_name),'{}'::jsonb) from (
      select id,display_name from public.people where tree_id=p_tree and p_task='relationship'
        and archived_at is null and not is_draft order by id limit 1000
    ) p),
    'sources', (select coalesce(jsonb_agg(evidence),'[]'::jsonb) from (
      select s.id,s.title,left(c.locator,300) as locator,c.person_id as "personId",c.life_event_id as "eventId"
      from public.source_citations c join public.sources s on s.tree_id=c.tree_id and s.id=c.source_id
      left join public.life_events e on e.tree_id=c.tree_id and e.id=c.life_event_id
      where c.tree_id=p_tree and p_task in ('summary','biography')
        and (c.person_id=any(selected) or (e.entry_kind='family' and e.verification_status='verified' and exists(
          select 1 from public.life_event_people ep where ep.tree_id=p_tree and ep.event_id=e.id and ep.person_id=any(selected))))
        and s.title not like 'Fictional practice record · %'
      order by c.id limit 25
    ) evidence),
    'matches', (select coalesce(jsonb_agg(item),'[]'::jsonb) from (
      select r.id,r.title,r.place,r.record_year as "year",r.collection,r.locator
      from familyroots_private.historical_catalog r join public.people p on p.tree_id=p_tree and p.id=selected[1]
      where p_task='matches' and lower(btrim(p.display_name))=lower(r.person_name)
      order by r.record_year,r.id limit 5
    ) item)
  );
end;
$$;
revoke all on function public.get_assistant_evidence(uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.get_assistant_evidence(uuid,uuid[],text) to authenticated;
