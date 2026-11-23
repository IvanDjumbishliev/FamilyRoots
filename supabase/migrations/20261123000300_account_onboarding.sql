alter table public.profiles
  add column preferred_language text not null default 'en'
  check (preferred_language in ('en', 'bg', 'fr', 'de', 'es'));

grant update (preferred_language) on public.profiles to authenticated;

create function public.complete_family_onboarding(p_display_name text, p_tree_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  first_tree uuid;
begin
  if account_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- The profile lock serializes concurrent onboarding calls for one account.
  update public.profiles
  set display_name = btrim(p_display_name)
  where id = account_id and length(btrim(p_display_name)) between 1 and 120;
  if not found then
    raise exception 'A display name is required' using errcode = '23514';
  end if;

  select tree_id into first_tree from public.tree_memberships
  where user_id = account_id
  order by created_at, id limit 1;

  if first_tree is null then
    if p_tree_name is null or length(btrim(p_tree_name)) not between 1 and 120 then
      raise exception 'A family tree name is required' using errcode = '23514';
    end if;
    insert into public.family_trees(owner_id, name)
    values (account_id, btrim(p_tree_name))
    returning id into first_tree;
  end if;
  return first_tree;
end;
$$;

revoke all on function public.complete_family_onboarding(text, text) from public, anon, authenticated;
grant execute on function public.complete_family_onboarding(text, text) to authenticated;
