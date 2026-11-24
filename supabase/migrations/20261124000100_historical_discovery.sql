create extension if not exists unaccent with schema extensions;

create table familyroots_private.historical_catalog (
  id text primary key,
  title text not null,
  person_name text not null,
  place text not null,
  record_year integer not null check (record_year between 1600 and 1925),
  record_type text not null check (record_type in ('birth','marriage','death','census','migration')),
  collection text not null,
  locator text not null,
  unique(collection,locator)
);

-- Fictional CC0 fixtures. No external collection or person is represented.
insert into familyroots_private.historical_catalog values
  ('valette-1872','Birth entry for Ada Valette','Ada Valette','Lyon, France',1872,'birth','Fictional Rhône civic registers','Lyon volume 12, entry 37'),
  ('valette-1896','Marriage entry for Ada Valette','Ada Valette','Lyon, France',1896,'marriage','Fictional Rhône civic registers','Lyon volume 26, entry 41'),
  ('valette-1900','Census entry for Ada Valette','Ada Valette','Montréal, Canada',1900,'census','Fictional Montréal enumerations','District 8, schedule 63'),
  ('valette-1904','Passenger entry for Ada Valette','Ada Valette','Québec, Canada',1904,'migration','Fictional St. Lawrence passenger lists','Register 4, sheet 17'),
  ('valette-1918','Death entry for Ada Valette','Ada Valette','Montréal, Canada',1918,'death','Fictional Montréal civic registers','Montréal volume 3, entry 18'),
  ('moreau-1884','Birth entry for Lucien Moreau','Lucien Moreau','Lyon, France',1884,'birth','Fictional Rhône civic registers','Lyon volume 16, entry 21'),
  ('duarte-1902','Passenger entry for Inês Duarte','Inês Duarte','Halifax, Canada',1902,'migration','Fictional Atlantic passenger lists','Register 9, sheet 29');
revoke all on familyroots_private.historical_catalog from public,anon,authenticated;

create table familyroots_private.discovery_rate_windows (
  provider text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null,
  primary key(provider,user_id)
);
revoke all on familyroots_private.discovery_rate_windows from public,anon,authenticated;

create function familyroots_private.mock_historical_record(r familyroots_private.historical_catalog)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'provider','fictional-archive','id',r.id,'title',r.title,'name',r.person_name,
    'place',r.place,'year',r.record_year,'type',r.record_type,'collection',r.collection,'locator',r.locator,
    'url','https://familyroots.example/fictional-records/' || r.id,'license','CC0-1.0',
    'retrievedAt',statement_timestamp(),'fictional',true);
$$;
revoke all on function familyroots_private.mock_historical_record(familyroots_private.historical_catalog) from public,anon,authenticated;

create function public.search_fictional_historical_records(
  p_name text,p_place text,p_from integer,p_to integer,p_type text
) returns setof jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_minute timestamptz:=date_trunc('minute',clock_timestamp()); used integer;
begin
  if actor is null then raise exception 'Sign in to search records' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 120 or p_place is null or length(p_place)>120
    or p_from is null or p_to is null or p_from not between 1600 and 1925 or p_to not between p_from and 1925
    or p_type is null or p_type not in ('all','birth','marriage','death','census','migration') then
    raise exception 'Invalid historical search filters' using errcode='22023';
  end if;
  insert into familyroots_private.discovery_rate_windows as w(provider,user_id,window_start,requests)
    values('fictional-archive',actor,current_minute,1)
    on conflict(provider,user_id) do update set window_start=excluded.window_start,
      requests=case when w.window_start=excluded.window_start then w.requests+1 else 1 end
      where w.window_start<>excluded.window_start or w.requests<20
    returning requests into used;
  if used is null then raise exception 'Search limit reached. Try again in a minute.' using errcode='P0001'; end if;
  return query select familyroots_private.mock_historical_record(r)
    from familyroots_private.historical_catalog r
    where strpos(extensions.unaccent(lower(r.person_name)),extensions.unaccent(lower(btrim(p_name))))>0
      and strpos(extensions.unaccent(lower(r.place)),extensions.unaccent(lower(btrim(p_place))))>0
      and r.record_year between p_from and p_to and (p_type='all' or r.record_type=p_type)
    order by r.record_year,r.id limit 50;
end;
$$;

create table public.research_findings (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  provider text not null,
  record_key text not null,
  record jsonb not null,
  saved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tree_id,id),
  unique(tree_id,provider,record_key)
);

create table public.research_matches (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  finding_id uuid not null,
  person_id uuid not null,
  status text not null check(status in ('rejected','attached','unverified')),
  related_person_id uuid,
  hypothesis text check(hypothesis in ('parent','child','partner')),
  citation_id uuid references public.source_citations(id) on delete cascade,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(tree_id,finding_id) references public.research_findings(tree_id,id) on delete cascade,
  foreign key(tree_id,person_id) references public.people(tree_id,id) on delete cascade,
  foreign key(tree_id,related_person_id) references public.people(tree_id,id) on delete cascade,
  unique(finding_id,person_id),
  check ((related_person_id is null)=(hypothesis is null)),
  check (status<>'unverified' or hypothesis is not null),
  check (related_person_id is null or related_person_id<>person_id),
  check ((status='attached')=(citation_id is not null))
);
create index research_matches_tree_person on public.research_matches(tree_id,person_id);

alter table public.research_findings enable row level security;
alter table public.research_matches enable row level security;
revoke all on public.research_findings,public.research_matches from public,anon,authenticated;
grant select on public.research_findings,public.research_matches to authenticated;
create policy research_findings_members on public.research_findings for select to authenticated
using (familyroots_private.current_tree_role(tree_id) is not null);
create policy research_matches_members on public.research_matches for select to authenticated
using (familyroots_private.current_tree_role(tree_id) is not null);
create trigger research_findings_audit after insert or update or delete on public.research_findings
for each row execute function familyroots_private.log_change();
create trigger research_matches_audit after insert or update or delete on public.research_matches
for each row execute function familyroots_private.log_change();

create function public.update_fictional_research(
  p_tree uuid,p_record text,p_action text,p_person uuid default null,
  p_related uuid default null,p_hypothesis text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare item familyroots_private.historical_catalog; finding uuid; source_id uuid; citation uuid; current_match public.research_matches;
begin
  if not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
    raise exception 'Tree editing permission is required' using errcode='42501';
  end if;
  perform 1 from public.family_trees where id=p_tree for update;
  if not found or not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
    raise exception 'Tree editing permission is required' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('save','attach','reject','hypothesis')
    or (p_action!='save' and p_person is null)
    or (p_action='hypothesis' and (p_related is null or p_related=p_person or p_hypothesis is null or p_hypothesis not in ('parent','child','partner'))) then
    raise exception 'Choose a profile or relationship hypothesis' using errcode='22023';
  end if;
  select * into item from familyroots_private.historical_catalog where id=p_record;
  if item.id is null then raise exception 'Record unavailable from the fictional provider' using errcode='22023'; end if;
  if p_action<>'save' and not exists(select 1 from public.people where tree_id=p_tree and id=p_person and archived_at is null and not is_draft) then
    raise exception 'Profile is unavailable in this tree' using errcode='42501';
  end if;
  if p_action='hypothesis' and not exists(select 1 from public.people where tree_id=p_tree and id=p_related and archived_at is null and not is_draft) then
    raise exception 'Related profile is unavailable in this tree' using errcode='42501';
  end if;
  insert into public.research_findings(tree_id,provider,record_key,record,saved_by)
  values(p_tree,'fictional-archive',item.id,familyroots_private.mock_historical_record(item),auth.uid())
  on conflict(tree_id,provider,record_key) do nothing returning id into finding;
  if finding is null then
    select id into finding from public.research_findings where tree_id=p_tree and provider='fictional-archive' and record_key=item.id;
  end if;
  if p_action='save' then return finding; end if;
  select * into current_match from public.research_matches where finding_id=finding and person_id=p_person;
  if current_match.status='attached' and p_action='attach' then return finding; end if;
  if current_match.status='attached' then
    raise exception 'This record is already attached to the selected person' using errcode='22023';
  end if;
  if p_action='attach' then
    insert into public.sources(tree_id,title,reference_url,rights_note,record_date,date_precision)
    values (p_tree,'Fictional practice record · '||item.title,null,
      'Fictional fixture · CC0-1.0; unsuitable as historical evidence',make_date(item.record_year,1,1),'year')
    returning id into source_id;
    insert into public.source_citations(tree_id,source_id,person_id,locator,notes)
    values (p_tree,source_id,p_person,item.collection||' · '||item.locator,'This citation is a fictional research example.')
    returning id into citation;
  end if;
  insert into public.research_matches(tree_id,finding_id,person_id,status,related_person_id,hypothesis,citation_id,decided_by)
  values(p_tree,finding,p_person,case p_action when 'attach' then 'attached' when 'reject' then 'rejected' else 'unverified' end,
    case when p_action='hypothesis' then p_related when p_action='attach' then current_match.related_person_id end,
    case when p_action='hypothesis' then p_hypothesis when p_action='attach' then current_match.hypothesis end,citation,auth.uid())
  on conflict(finding_id,person_id) do update set status=excluded.status,related_person_id=excluded.related_person_id,
    hypothesis=excluded.hypothesis,citation_id=excluded.citation_id,decided_by=excluded.decided_by,updated_at=now();
  return finding;
end;
$$;
revoke all on function public.search_fictional_historical_records(text,text,integer,integer,text),
  public.update_fictional_research(uuid,text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.search_fictional_historical_records(text,text,integer,integer,text),
  public.update_fictional_research(uuid,text,text,uuid,uuid,text) to authenticated;
