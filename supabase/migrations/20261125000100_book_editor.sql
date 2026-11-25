-- Phase 16: Family History Book Editor Migration
-- Adds revisions history table, draft saving RPC, and support for templates, font themes, custom sections & media captions

create table if not exists public.family_book_revisions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.family_books(id) on delete cascade,
  revision integer not null,
  title text not null,
  settings jsonb not null,
  sections jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists family_book_revisions_book on public.family_book_revisions(book_id, revision desc);

alter table public.family_book_revisions enable row level security;
revoke all on public.family_book_revisions from public,anon,authenticated;
grant select on public.family_book_revisions to authenticated;

create policy family_book_revisions_owner_read on public.family_book_revisions for select to authenticated
using (exists(
  select 1 from public.family_books b
  where b.id=family_book_revisions.book_id and b.creator_id=(select auth.uid())
    and familyroots_private.current_tree_role(b.tree_id) is not null
));

create or replace function public.save_family_book_draft(
  p_id uuid,
  p_revision integer,
  p_settings jsonb,
  p_sections jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare
  book public.family_books%rowtype;
  new_revision integer;
begin
  select * into book from public.family_books where id=p_id and creator_id=auth.uid() for update;
  if not found or not coalesce(familyroots_private.current_tree_role(book.tree_id) in ('owner','editor'),false) then
    raise exception 'Book editing permission is required' using errcode='42501';
  end if;
  if book.revision<>p_revision or book.status in ('queued','working') then
    raise exception 'Refresh this book before saving changes' using errcode='P0002';
  end if;
  if p_settings is null or octet_length(p_settings::text)>32000
    or not coalesce(length(btrim(p_settings->>'title')) between 1 and 120,false) then
    raise exception 'Provide valid book settings' using errcode='22023';
  end if;
  if p_sections is null or jsonb_typeof(p_sections)<>'array' or jsonb_array_length(p_sections)>60 then
    raise exception 'Provide valid book sections' using errcode='22023';
  end if;

  -- Archive current revision to revisions history table
  insert into public.family_book_revisions(book_id, revision, title, settings, sections)
  values(book.id, book.revision, coalesce(book.settings->>'title', 'Untitled'), book.settings, book.sections);

  new_revision := book.revision + 1;

  update public.family_books
  set settings = p_settings,
      sections = p_sections,
      revision = new_revision,
      status = 'ready',
      error = null,
      updated_at = now()
  where id = p_id;

  return new_revision;
end;
$$;

revoke all on function public.save_family_book_draft(uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_family_book_draft(uuid,integer,jsonb,jsonb) to authenticated;
