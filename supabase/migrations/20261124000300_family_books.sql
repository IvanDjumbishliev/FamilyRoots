create table public.family_books (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  settings jsonb not null,
  sections jsonb not null default '[]'::jsonb,
  snapshot jsonb,
  status text not null default 'queued' check (status in ('queued','working','ready','failed')),
  operation text not null default 'draft' check (operation in ('draft','section','pdf')),
  section_key text,
  revision integer not null default 1,
  attempts integer not null default 0,
  lease uuid,
  claimed_at timestamptz,
  error text,
  pdf_path text,
  pdf_revision integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index family_books_creator on public.family_books(creator_id,updated_at desc);
create index family_books_jobs on public.family_books(updated_at) where status in ('queued','working');
alter table public.family_books enable row level security;
revoke all on public.family_books from public,anon,authenticated;
grant select on public.family_books to authenticated;
create policy family_books_owner_read on public.family_books for select to authenticated
using (creator_id=(select auth.uid()) and familyroots_private.current_tree_role(tree_id) is not null);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('family-books','family-books',false,10485760,array['application/pdf']);
create policy family_books_download on storage.objects for select to authenticated
using (bucket_id='family-books' and exists(select 1 from public.family_books b
  where b.pdf_path=storage.objects.name and b.status='ready' and b.pdf_revision=b.revision and b.creator_id=(select auth.uid())));

create function public.create_family_book(p_tree uuid,p_settings jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare book uuid;
begin
  if not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
    raise exception 'Tree editing permission is required' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  if (select count(*) from public.family_books where creator_id=auth.uid() and created_at>now()-interval '1 day')>=12 then
    raise exception 'Daily book draft limit reached' using errcode='P0001';
  end if;
  if p_settings is null or octet_length(p_settings::text)>18000
    or not coalesce(length(btrim(p_settings->>'title')) between 1 and 120,false)
    or not coalesce(p_settings->>'privacy' in ('private','full'),false)
    or (p_settings->>'privacy'='full' and p_settings->'consent' is distinct from 'true'::jsonb) then
    raise exception 'Provide valid book settings and sharing consent' using errcode='22023';
  end if;
  if nullif(p_settings->>'branch','') is not null and not exists(select 1 from public.people p
    where p.tree_id=p_tree and p.id::text=p_settings->>'branch' and p.archived_at is null and not p.is_draft) then
    raise exception 'Branch unavailable in this tree' using errcode='42501';
  end if;
  insert into public.family_books(tree_id,creator_id,settings) values(p_tree,auth.uid(),p_settings) returning id into book;
  return book;
end;
$$;

create function public.queue_family_book(p_id uuid,p_revision integer,p_action text,p_section text default null,p_reviewed boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare book public.family_books%rowtype;
begin
  select * into book from public.family_books where id=p_id and creator_id=auth.uid() for update;
  if not found or not coalesce(familyroots_private.current_tree_role(book.tree_id) in ('owner','editor'),false) then
    raise exception 'Book editing permission is required' using errcode='42501';
  end if;
  if book.revision<>p_revision or book.status in ('queued','working') then
    raise exception 'Refresh this book before starting another job' using errcode='P0002';
  end if;
  if p_action='retry' and book.status='failed' then
    p_action:=book.operation; p_section:=book.section_key;
  elsif p_action='section' and exists(select 1 from jsonb_array_elements(book.sections) e where e->>'key'=p_section) then
    null;
  elsif p_action='pdf' and p_reviewed and jsonb_array_length(book.sections)>0 then
    p_section:=null;
  else raise exception 'Choose an existing draft or section' using errcode='22023';
  end if;
  update public.family_books set status='queued',operation=p_action,section_key=p_section,revision=revision+1,
    attempts=0,lease=null,claimed_at=null,error=null,updated_at=now() where id=p_id;
end;
$$;

create function public.edit_family_book_section(p_id uuid,p_revision integer,p_key text,p_body text)
returns void language plpgsql security definer set search_path='' as $$
declare book public.family_books%rowtype;
begin
  select * into book from public.family_books where id=p_id and creator_id=auth.uid() for update;
  if not found or not coalesce(familyroots_private.current_tree_role(book.tree_id) in ('owner','editor'),false) then
    raise exception 'Book editing permission is required' using errcode='42501';
  end if;
  if book.revision<>p_revision or book.status in ('queued','working') then
    raise exception 'Refresh this section before saving' using errcode='P0002';
  end if;
  if p_body is null or length(p_body)>20000 or not exists(select 1 from jsonb_array_elements(book.sections) e where e->>'key'=p_key) then
    raise exception 'Choose a section and enter up to 20,000 characters' using errcode='22023';
  end if;
  update public.family_books set sections=(select jsonb_agg(case when e->>'key'=p_key
    then e || jsonb_build_object('edit',p_body) else e end order by n) from jsonb_array_elements(book.sections) with ordinality s(e,n)),
    status='ready',error=null,revision=revision+1,updated_at=now() where id=p_id;
end;
$$;

create function public.claim_family_book(p_id uuid default null)
returns setof public.family_books language plpgsql security definer set search_path='' as $$
begin
  update public.family_books set status='failed',error='The worker timed out. Retry to start a new job.',lease=null,updated_at=now()
    where status='working' and claimed_at < now()-interval '3 minutes' and attempts>=2
      and (p_id is null or id=p_id);
  return query with next_job as (
    select b.id from public.family_books b where (p_id is null or b.id=p_id)
      and (b.status='queued' or (b.status='working' and b.claimed_at<now()-interval '3 minutes'))
    order by b.updated_at,b.id limit 1 for update skip locked
  )
  update public.family_books b set status='working',attempts=b.attempts+1,lease=gen_random_uuid(),claimed_at=now(),updated_at=now()
    from next_job n where b.id=n.id returning b.*;
end;
$$;

create function public.finish_family_book(
  p_id uuid,p_lease uuid,p_sections jsonb default null,p_pdf text default null,p_error text default null,p_snapshot jsonb default null
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.family_books b set status=case when p_error is null then 'ready' else 'failed' end,
    sections=coalesce(p_sections,b.sections),snapshot=coalesce(p_snapshot,b.snapshot),pdf_path=case when p_error is null then p_pdf else b.pdf_path end,
    pdf_revision=case when p_error is null and p_pdf is not null then b.revision end,
    error=left(p_error,240),lease=null,updated_at=now()
  where b.id=p_id and b.lease=p_lease and b.status='working';
  return found;
end;
$$;

create function public.get_family_book_context(p_id uuid,p_lease uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare book public.family_books%rowtype; redacted boolean; data jsonb; branch uuid;
begin
  select * into book from public.family_books where id=p_id and lease=p_lease and status='working';
  if not found or not exists(select 1 from public.tree_memberships m
    where m.tree_id=book.tree_id and m.user_id=book.creator_id and m.role in ('owner','editor')) then
    raise exception 'Book generation permission is unavailable' using errcode='42501';
  end if;
  if book.operation='section' and book.snapshot is not null then return book.snapshot; end if;
  redacted:=book.settings->>'privacy'='private';
  branch:=nullif(book.settings->>'branch','')::uuid;
  if branch is not null and not exists(select 1 from public.people p where p.tree_id=book.tree_id
    and p.id=branch and p.archived_at is null and not p.is_draft) then
    raise exception 'Branch unavailable in this tree' using errcode='42501';
  end if;
  with recursive descendants(id) as (
    select branch where branch is not null
    union
    select r.child_id from descendants d join public.parent_child_relationships r
      on r.tree_id=book.tree_id and r.parent_id=d.id and r.verification_status='verified'
      and r.provenance<>'ai_suggested' and r.kind in ('biological','adoptive')
  ), people as materialized (
    select p.* from public.people p where p.tree_id=book.tree_id and p.archived_at is null and not p.is_draft
      and (branch is null or p.id in (select id from descendants))
      and (not redacted or p.living_status='deceased')
    order by p.display_name,p.id limit 101
  ), events as materialized (
    select e.* from public.life_events e where e.tree_id=book.tree_id and e.entry_kind='family'
      and e.verification_status='verified'
      and e.id::text in (select jsonb_array_elements_text(book.settings->'events'))
      and exists(select 1 from public.life_event_people ep join people p on p.id=ep.person_id where ep.event_id=e.id)
      and not exists(select 1 from public.life_event_people ep where ep.event_id=e.id
        and not exists(select 1 from people p where p.id=ep.person_id))
    order by e.occurred_on nulls last,e.id limit 101
  )
  select jsonb_build_object(
    'people',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.display_name,'verified',p.verification_status='verified',
      'birth',p.birth_date,'birthPrecision',p.birth_date_precision,'birthApproximate',p.birth_date_approximate,
      'death',p.death_date,'deathPrecision',p.death_date_precision,'deathApproximate',p.death_date_approximate,
      'birthPlace',case when not redacted then p.birth_place end,'deathPlace',case when not redacted then p.death_place end,
      'occupation',case when not redacted then p.occupation end,
      'biography',case when not redacted then left(p.biography,1200) end
    ) order by p.display_name,p.id),'[]'::jsonb) from people p),
    'edges',(select coalesce(jsonb_agg(jsonb_build_object('parent',r.parent_id,'child',r.child_id,'kind',r.kind)
      order by r.id),'[]'::jsonb) from public.parent_child_relationships r join people p on p.id=r.parent_id
      join people c on c.id=r.child_id where r.tree_id=book.tree_id and r.verification_status='verified'
      and r.provenance<>'ai_suggested' and r.kind in ('biological','adoptive')),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,
      'title',case when redacted then null else e.title end,'type',case when e.event_type in ('birth','death','partnership','migration','education','occupation','military_service','residence') then e.event_type else 'custom' end,
      'day',e.occurred_on,'precision',e.date_precision,'approximate',e.date_approximate,
      'people',(select jsonb_agg(p.display_name order by p.display_name) from public.life_event_people ep
        join people p on p.id=ep.person_id where ep.event_id=e.id)
    ) order by e.occurred_on nulls last,e.id),'[]'::jsonb) from events e),
    'sources',(select coalesce(jsonb_agg(refs),'[]'::jsonb) from (
      select c.id,c.person_id as "personId",c.life_event_id as "eventId",
        case when not redacted then s.title end as title,
        case when not redacted then left(c.locator,200) end as locator,
        case when not redacted then left(s.reference_url,400) end as url
      from public.source_citations c join public.sources s on s.tree_id=c.tree_id and s.id=c.source_id
      where c.tree_id=book.tree_id and s.title not like 'Fictional practice record · %'
        and (c.person_id in (select id from people) or c.life_event_id in (select id from events))
      order by c.id limit 151
    ) refs),
    'media',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',a.id,'title',a.title,'credit',left(a.source_note,400),'mime',a.mime_type,
        'path',a.thumbnail_path,'description',left(a.description,400)
      ) order by a.id),'[]'::jsonb) from public.archive_items a
      where not redacted and a.tree_id=book.tree_id and a.state='ready'
        and a.id::text in (select jsonb_array_elements_text(book.settings->'media'))
        and (branch is null or exists(select 1 from public.archive_item_people l join people p on p.id=l.person_id where l.item_id=a.id)))
  ) into data;
  return data;
end;
$$;

revoke all on function public.create_family_book(uuid,jsonb),public.queue_family_book(uuid,integer,text,text,boolean),
  public.edit_family_book_section(uuid,integer,text,text),public.claim_family_book(uuid),
  public.finish_family_book(uuid,uuid,jsonb,text,text,jsonb),public.get_family_book_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_family_book(uuid,jsonb),public.queue_family_book(uuid,integer,text,text,boolean),
  public.edit_family_book_section(uuid,integer,text,text) to authenticated;
grant execute on function public.claim_family_book(uuid),public.finish_family_book(uuid,uuid,jsonb,text,text,jsonb),
  public.get_family_book_context(uuid,uuid) to service_role;
