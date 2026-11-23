create table public.tree_invitations (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  email text not null check (length(email) <= 254 and email = lower(btrim(email))),
  role public.tree_role not null check (role in ('editor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  consent_confirmed_at timestamptz not null default now(),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  last_attempt_at timestamptz,
  delivery_attempt uuid,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tree_invitations_pending_idx on public.tree_invitations(tree_id,email) where status='pending';
create index tree_invitations_email_idx on public.tree_invitations(email,expires_at) where status='pending';
create index tree_invitations_tree_created_idx on public.tree_invitations(tree_id,created_at desc);
alter table public.tree_invitations enable row level security;
revoke all on public.tree_invitations from public,anon,authenticated;

create table public.tree_update_reads (
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(tree_id,user_id)
);
alter table public.tree_update_reads enable row level security;
revoke all on public.tree_update_reads from public,anon,authenticated;

create function familyroots_private.verified_account_email()
returns text language sql stable security definer set search_path='' as $$
  select lower(email) from auth.users where id=(select auth.uid()) and email_confirmed_at is not null;
$$;
revoke all on function familyroots_private.verified_account_email() from public,anon,authenticated;

create function public.request_tree_invitation(p_tree uuid,p_email text,p_role public.tree_role,p_consent boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare address text:=lower(btrim(p_email)); invitation public.tree_invitations; attempt uuid:=gen_random_uuid();
begin
  if p_consent is distinct from true then
    raise exception 'Sharing consent required' using errcode='23514';
  end if;
  if p_role is null or p_role not in ('editor','viewer') or address is null or length(address)>254
    or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email and role' using errcode='23514';
  end if;
  perform 1 from public.family_trees where id=p_tree for update;
  if not coalesce(familyroots_private.current_tree_role(p_tree)='owner',false) then
    raise exception 'Owner permission required' using errcode='42501';
  end if;
  if exists(select 1 from public.tree_memberships m join auth.users u on u.id=m.user_id
    where m.tree_id=p_tree and lower(u.email)=address) then
    raise exception 'This person already belongs to this tree' using errcode='23505';
  end if;
  update public.tree_invitations set status='expired',updated_at=now() where tree_id=p_tree and email=address and status='pending' and expires_at<=now();
  select * into invitation from public.tree_invitations where tree_id=p_tree and email=address and status='pending';
  if found then
    if invitation.last_attempt_at > now()-interval '60 seconds' then
      raise exception 'Wait before resending this invitation' using errcode='P0001';
    end if;
    update public.tree_invitations set role=p_role,last_attempt_at=now(), consent_confirmed_at=now(), delivery_attempt=attempt,updated_at=now()
    where id=invitation.id returning * into invitation;
  else
    if (select count(*) from public.tree_invitations where tree_id=p_tree and created_at>now()-interval '1 day')>=30 then
      raise exception 'Daily invitation limit reached' using errcode='P0001';
    end if;
    insert into public.tree_invitations(tree_id,email,role,invited_by,last_attempt_at,delivery_attempt)
    values(p_tree,address,p_role,auth.uid(),now(),attempt) returning * into invitation;
  end if;
  return jsonb_build_object('id',invitation.id,'email',invitation.email,'attempt',attempt);
end;
$$;

create function public.record_invitation_delivery(p_id uuid,p_attempt uuid)
returns void language sql security definer set search_path='' as $$
  update public.tree_invitations set sent_at=now(),updated_at=now()
  where id=p_id and delivery_attempt=p_attempt and status='pending';
$$;

create function public.list_my_tree_invitations()
returns table(id uuid,role public.tree_role,expires_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select i.id,i.role,i.expires_at,i.created_at from public.tree_invitations i
  where i.email=familyroots_private.verified_account_email() and i.status='pending' and i.expires_at>now()
  order by i.created_at desc;
$$;

create function public.respond_to_tree_invitation(p_id uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.tree_invitations; address text:=familyroots_private.verified_account_email(); target uuid;
begin
  if address is null or p_accept is null then raise exception 'Invitation is unavailable' using errcode='42501'; end if;
  select tree_id into target from public.tree_invitations where id=p_id and email=address;
  perform 1 from public.family_trees where id=target for update;
  select * into invitation from public.tree_invitations where id=p_id and email=address and status='pending' and expires_at>now() for update;
  if not found then raise exception 'Invitation is unavailable or expired' using errcode='42501'; end if;
  if p_accept then
    insert into public.tree_memberships(tree_id,user_id,role) values(invitation.tree_id,auth.uid(),invitation.role)
    on conflict(tree_id,user_id) do nothing;
  end if;
  update public.tree_invitations set status=case when p_accept then 'accepted' else 'declined' end, responded_at=now(),updated_at=now()
  where id=invitation.id;
  return invitation.tree_id;
end;
$$;

create function public.cancel_tree_invitation(p_tree uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.family_trees where id=p_tree for update;
  if not coalesce(familyroots_private.current_tree_role(p_tree)='owner',false) then
    raise exception 'Owner permission required' using errcode='42501';
  end if;
  update public.tree_invitations set status='revoked',updated_at=now() where id=p_id and tree_id=p_tree and status='pending';
end;
$$;

revoke insert,update,delete on public.tree_memberships from authenticated;
revoke insert(tree_id,user_id,role),update(role) on public.tree_memberships from authenticated;

create function public.manage_tree_member(p_tree uuid,p_member uuid,p_role public.tree_role,p_remove boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.family_trees where id=p_tree for update;
  if not coalesce(familyroots_private.current_tree_role(p_tree)='owner',false) or p_role='owner' then
    raise exception 'Owner permission required' using errcode='42501';
  end if;
  if p_remove then
    delete from public.tree_memberships where tree_id=p_tree and user_id=p_member and role<>'owner';
    if not found then raise exception 'Member cannot be removed' using errcode='42501'; end if;
    update public.tree_invitations set status='revoked',updated_at=now()
    where tree_id=p_tree and status='pending' and email=(select lower(email) from auth.users where id=p_member);
    delete from public.tree_update_reads where tree_id=p_tree and user_id=p_member;
  else
    update public.tree_memberships set role=p_role where tree_id=p_tree and user_id=p_member and role<>'owner';
    if not found then raise exception 'Member role cannot be changed' using errcode='42501'; end if;
  end if;
end;
$$;

create table public.collaboration_comments (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  person_id uuid,
  archive_item_id uuid,
  source_id uuid,
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(tree_id,person_id) references public.people(tree_id,id) on delete cascade,
  foreign key(tree_id,archive_item_id) references public.archive_items(tree_id,id) on delete cascade,
  foreign key(tree_id,source_id) references public.sources(tree_id,id) on delete cascade,
  check (num_nonnulls(person_id,archive_item_id,source_id)=1)
);
create index collaboration_comments_person_idx on public.collaboration_comments(tree_id,person_id,created_at);
create index collaboration_comments_archive_idx on public.collaboration_comments(tree_id,archive_item_id,created_at);
create index collaboration_comments_source_idx on public.collaboration_comments(tree_id,source_id,created_at);
alter table public.collaboration_comments enable row level security;
revoke all on public.collaboration_comments from public,anon,authenticated;
grant select,insert(tree_id,person_id,archive_item_id,source_id,body) on public.collaboration_comments to authenticated;

create policy collaboration_comments_read on public.collaboration_comments for select to authenticated
using (familyroots_private.current_tree_role(tree_id) is not null
  and (archive_item_id is null or exists(select 1 from public.archive_items a where a.id=archive_item_id and a.tree_id=collaboration_comments.tree_id)));
create policy collaboration_comments_insert on public.collaboration_comments for insert to authenticated
with check (author_id=auth.uid() and familyroots_private.current_tree_role(tree_id) in ('owner','editor')
  and (archive_item_id is null or exists(select 1 from public.archive_items a where a.id=archive_item_id and a.tree_id=collaboration_comments.tree_id)));
create trigger collaboration_comments_audit after insert on public.collaboration_comments
for each row execute function familyroots_private.log_change();

create function public.mark_tree_updates_read(p_tree uuid,p_through timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if familyroots_private.current_tree_role(p_tree) is null then raise exception 'Tree membership required' using errcode='42501'; end if;
  insert into public.tree_update_reads(tree_id,user_id,read_at)
  values(p_tree,auth.uid(),least(coalesce(p_through,now()),now()))
  on conflict(tree_id,user_id) do update set read_at=greatest(public.tree_update_reads.read_at,excluded.read_at);
end;
$$;

create function public.get_tree_collaboration(p_tree uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare my_role public.tree_role:=familyroots_private.current_tree_role(p_tree); watermark timestamptz;
begin
  if my_role is null then raise exception 'Tree membership required' using errcode='42501'; end if;
  select read_at into watermark from public.tree_update_reads where tree_id=p_tree and user_id=auth.uid();
  return jsonb_build_object(
    'role',my_role,
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,'name',nullif(p.display_name,'')) order by m.role,p.display_name),'[]')
      from public.tree_memberships m join public.profiles p on p.id=m.user_id where m.tree_id=p_tree),
    'invitations',case when my_role='owner' then (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,
      'status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,'expiresAt',i.expires_at,'sentAt',i.sent_at)
      order by i.created_at desc),'[]') from (select * from public.tree_invitations where tree_id=p_tree order by created_at desc limit 40) i) else '[]'::jsonb end,
    'changes',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'actorId',a.actor_id,'entity',a.entity_type,'operation',a.operation,
      'at',a.created_at,'fields',a.changed_fields,'unread',a.created_at>coalesce(watermark,'-infinity') and a.actor_id is distinct from auth.uid())
      order by a.created_at desc,a.id),'[]') from (select * from public.activity_logs where tree_id=p_tree
      and entity_type not in ('media_assets','source_citations')
      order by created_at desc,id limit 40) a)
  );
end;
$$;

revoke all on function public.request_tree_invitation(uuid,text,public.tree_role,boolean), public.list_my_tree_invitations(),
  public.respond_to_tree_invitation(uuid,boolean), public.cancel_tree_invitation(uuid,uuid), public.manage_tree_member(uuid,uuid,public.tree_role,boolean),
  public.mark_tree_updates_read(uuid,timestamptz), public.get_tree_collaboration(uuid), public.record_invitation_delivery(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.request_tree_invitation(uuid,text,public.tree_role,boolean), public.list_my_tree_invitations(),
  public.respond_to_tree_invitation(uuid,boolean), public.cancel_tree_invitation(uuid,uuid), public.manage_tree_member(uuid,uuid,public.tree_role,boolean),
  public.mark_tree_updates_read(uuid,timestamptz), public.get_tree_collaboration(uuid) to authenticated;
grant execute on function public.record_invitation_delivery(uuid,uuid) to service_role;

create table public.tree_reviews (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees(id) on delete cascade,
  target_type text not null check(target_type in ('people','life_events','parent_child_relationships','partnerships','other_family_relationships')),
  target_id uuid not null,
  field text not null,
  base_value text,
  proposed_value text,
  reason text not null check(length(btrim(reason)) between 1 and 2000),
  status text not null default 'pending' check(status in ('pending','applied','kept_current')),
  proposed_by uuid default auth.uid() references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tree_reviews_queue_idx on public.tree_reviews(tree_id,status,created_at desc);
create unique index tree_reviews_pending_dispute_idx on public.tree_reviews(tree_id,target_type,target_id)
where field='verification_status' and status='pending';

alter table public.tree_reviews enable row level security;
revoke all on public.tree_reviews from public,anon,authenticated;
grant select on public.tree_reviews to authenticated;
create policy tree_reviews_member_read on public.tree_reviews for select to authenticated
using (familyroots_private.current_tree_role(tree_id) is not null);
create trigger tree_reviews_audit after insert or update on public.tree_reviews
for each row execute function familyroots_private.log_change();

create function public.propose_tree_review(
  p_tree uuid,p_target_type text,p_target uuid,p_field text,p_proposed text,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing jsonb; review_id uuid; is_dispute boolean;
begin
  perform 1 from public.family_trees where id=p_tree for update;
  if not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
    raise exception 'Editor permission required' using errcode='42501';
  end if;
  is_dispute:=p_target_type in ('parent_child_relationships','partnerships','other_family_relationships') and p_field='verification_status';
  if not coalesce(is_dispute
    or (p_target_type='people' and p_field in ('biography','notes','occupation','nationality','birth_place','death_place'))
    or (p_target_type='life_events' and p_field in ('title','notes','place')),false)
    or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then
    raise exception 'Invalid proposal' using errcode='23514';
  end if;
  if not is_dispute and (
    length(coalesce(p_proposed,'')) >
      case when p_field in ('nationality','occupation','title') then 160
        when p_field in ('birth_place','death_place','place') then 240
        when p_target_type='life_events' then 6000 else 10000 end
    or (p_field='title' and nullif(btrim(p_proposed),'') is null)
  ) then raise exception 'Invalid proposed value' using errcode='23514'; end if;

  execute format('select to_jsonb(r) from public.%I r where r.tree_id=$1 and r.id=$2 for update',p_target_type)
    into existing using p_tree,p_target;
  if existing is null then raise exception 'Record is unavailable' using errcode='42501'; end if;
  insert into public.tree_reviews(tree_id,target_type,target_id,field,base_value,proposed_value,reason)
  values(p_tree,p_target_type,p_target,p_field,existing->>p_field,case when is_dispute then 'disputed' else nullif(btrim(p_proposed),'') end,btrim(p_reason))
  returning id into review_id;
  if is_dispute and existing->>p_field<>'disputed' then
    execute format('update public.%I set verification_status=''disputed'' where tree_id=$1 and id=$2',p_target_type) using p_tree,p_target;
  end if;
  return review_id;
end;
$$;

create function public.inspect_tree_review(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare review public.tree_reviews; current_record jsonb;
begin
  select * into review from public.tree_reviews where id=p_id;
  if not found or familyroots_private.current_tree_role(review.tree_id) is null then
    raise exception 'Review is unavailable' using errcode='42501';
  end if;
  execute format('select to_jsonb(r) from public.%I r where r.tree_id=$1 and r.id=$2',review.target_type)
    into current_record using review.tree_id,review.target_id;
  return jsonb_build_object('value',current_record->>review.field,'version',current_record->>'updated_at','available',current_record is not null,
    'label',coalesce(current_record->>'display_name',current_record->>'title',current_record->>'label',replace(review.target_type,'_',' ')),
    'aiSuggested',coalesce(current_record->>'provenance'='ai_suggested',false));
end;
$$;

create function public.resolve_tree_review(p_id uuid,p_decision text,p_note text,p_version timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
declare review public.tree_reviews; changed integer; next_value text; target_tree uuid;
begin
  select tree_id into target_tree from public.tree_reviews where id=p_id;
  perform 1 from public.family_trees where id=target_tree for update;
  select * into review from public.tree_reviews where id=p_id and status='pending' for update;
  if not found or not coalesce(familyroots_private.current_tree_role(review.tree_id)='owner',false) then
    raise exception 'Owner permission required' using errcode='42501';
  end if;
  if coalesce(length(p_note),0)>2000 or p_decision is null then raise exception 'Invalid review decision' using errcode='23514'; end if;
  update public.tree_reviews set status=case when p_decision='keep' then 'kept_current' else 'applied' end,
    resolved_by=auth.uid(),resolution_note=nullif(btrim(p_note),''),resolved_at=now(),updated_at=now()
    where id=review.id;
  if p_decision <> 'keep' then
    if review.field='verification_status' and p_decision in ('verified','unverified') then
      execute format('update public.%I set verification_status=$1::public.verification_status where tree_id=$2 and id=$3 and updated_at=$4',review.target_type)
        using p_decision,review.tree_id,review.target_id,p_version;
    elsif review.field<>'verification_status' and p_decision='apply' then
      next_value:=review.proposed_value;
      execute format('update public.%I set %I=$1 where tree_id=$2 and id=$3 and updated_at=$4',review.target_type,review.field)
        using next_value,review.tree_id,review.target_id,p_version;
    else raise exception 'Invalid review decision' using errcode='23514'; end if;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Record changed. Review the latest value before applying.' using errcode='P0002'; end if;
  end if;
end;
$$;

revoke all on function public.propose_tree_review(uuid,text,uuid,text,text,text),public.inspect_tree_review(uuid),
 public.resolve_tree_review(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.propose_tree_review(uuid,text,uuid,text,text,text),public.inspect_tree_review(uuid),
 public.resolve_tree_review(uuid,text,text,timestamptz) to authenticated;

create function public.save_versioned_family_connection(p_tree uuid,p_person uuid,p_connection jsonb,p_version timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid:=nullif(p_connection->>'id','')::uuid; updated timestamptz; target_table text;
begin
  if target is not null then
    if not coalesce(familyroots_private.current_tree_role(p_tree) in ('owner','editor'),false) then
      raise exception 'Editor permission required' using errcode='42501';
    end if;
    target_table:=case p_connection->>'category' when 'parent' then 'parent_child_relationships'
      when 'partnership' then 'partnerships' when 'other' then 'other_family_relationships' end;
    if target_table is null then raise exception 'Invalid relationship' using errcode='23514'; end if;
    execute format('select updated_at from public.%I where tree_id=$1 and id=$2 for update',target_table)
      into updated using p_tree,target;
    if updated is null or p_version is null or updated<>p_version then
      raise exception 'Connection changed. Reload the current relationship.' using errcode='P0002';
    end if;
  end if;
  return public.save_family_connection(p_tree,p_person,p_connection);
end;
$$;
revoke all on function public.save_versioned_family_connection(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.save_versioned_family_connection(uuid,uuid,jsonb,timestamptz) to authenticated;

create function familyroots_private.keep_pending_dispute()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.verification_status='disputed' and new.verification_status<>'disputed' and exists
    (select 1 from public.tree_reviews where tree_id=old.tree_id and target_type=tg_table_name
      and target_id=old.id and field='verification_status' and status='pending') then
    raise exception 'Resolve the pending dispute in Family collaboration' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function familyroots_private.keep_pending_dispute() from public,anon,authenticated;
create trigger keep_parent_dispute before update on public.parent_child_relationships
for each row execute function familyroots_private.keep_pending_dispute();
create trigger keep_partnership_dispute before update on public.partnerships
for each row execute function familyroots_private.keep_pending_dispute();
create trigger keep_other_relationship_dispute before update on public.other_family_relationships
for each row execute function familyroots_private.keep_pending_dispute();

create function public.update_versioned_archive_item(p_id uuid,p_meta jsonb,p_people uuid[],p_version timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare item public.archive_items;
begin
  select * into item from public.archive_items where id=p_id and state='ready' for update;
  if not found or not coalesce(familyroots_private.current_tree_role(item.tree_id) in ('owner','editor'),false) then
    raise exception 'Archive write access required' using errcode='42501';
  end if;
  if p_version is distinct from item.updated_at then
    raise exception 'Archive item changed. Check the latest version before editing.' using errcode='P0002';
  end if;
  perform public.update_archive_item(p_id,p_meta,p_people);
end;
$$;
revoke all on function public.update_versioned_archive_item(uuid,jsonb,uuid[],timestamptz) from public,anon,authenticated;
grant execute on function public.update_versioned_archive_item(uuid,jsonb,uuid[],timestamptz) to authenticated;
