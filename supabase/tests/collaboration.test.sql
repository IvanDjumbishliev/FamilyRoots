begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id,aud,role,email,email_confirmed_at) values
  ('10000000-0000-4000-8000-000000000011','authenticated','authenticated','relative@example.invalid',now()),
  ('10000000-0000-4000-8000-000000000012','authenticated','authenticated','unverified@example.invalid',null);
create temporary table fixtures (key text primary key, value text);
grant all on fixtures to authenticated;
select set_config('app.test_tree','20000000-0000-4000-8000-000000000001',true);
select set_config('app.test_person','30000000-0000-4000-8000-000000000001',true);
select set_config('app.test_relative','10000000-0000-4000-8000-000000000011',true);
select set_config('app.test_relationship','40000000-0000-4000-8000-000000000001',true);
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($$select public.request_tree_invitation(current_setting('app.test_tree')::uuid,'relative@example.invalid','viewer',false)$$,
  '23514','Sharing consent required','owner must confirm consent before recording an invitation');
insert into fixtures values
  ('invitation', public.request_tree_invitation(current_setting('app.test_tree')::uuid,' Relative@Example.Invalid ','viewer',true)->>'id'),
  ('unverified', public.request_tree_invitation(current_setting('app.test_tree')::uuid,'unverified@example.invalid','viewer',true)->>'id');
select throws_ok($$select public.request_tree_invitation(current_setting('app.test_tree')::uuid,'relative@example.invalid','viewer',true)$$,
  'P0001',null,'resends are throttled');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000012","role":"authenticated"}';
select is((select count(*) from public.list_my_tree_invitations()),0::bigint,'unverified recipient cannot see invitations');
select throws_ok($$select public.respond_to_tree_invitation((select value::uuid from fixtures where key='unverified'),true)$$,
  '42501',null,'unverified recipient cannot accept');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.respond_to_tree_invitation((select value::uuid from fixtures where key='invitation'),true)$$,
  '42501',null,'other account cannot use the invitation ID');
select throws_ok($$select public.get_tree_collaboration(current_setting('app.test_tree')::uuid)$$,
  '42501',null,'outsider cannot read the activity or roster');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}';
select is((select count(*) from public.list_my_tree_invitations()),1::bigint,'verified matching email sees the pending invitation');
select is((select count(*) from public.people),0::bigint,'pending invitation grants zero tree access');
select is(public.respond_to_tree_invitation((select value::uuid from fixtures where key='invitation'),true),
  current_setting('app.test_tree')::uuid,'verified recipient accepts invitation');
select is((select count(*) from public.people),2::bigint,'viewer can read the shared tree');
select is(jsonb_array_length(public.get_tree_collaboration(current_setting('app.test_tree')::uuid)->'invitations'),0,
  'viewer cannot see the owner invitation register');
select throws_ok($$insert into public.collaboration_comments(tree_id,person_id,body)
  values(current_setting('app.test_tree')::uuid,current_setting('app.test_person')::uuid,'Viewer comment')$$,
  '42501',null,'viewer cannot post comments');
select throws_ok($$select public.manage_tree_member(current_setting('app.test_tree')::uuid,auth.uid(),'editor')$$,
  '42501',null,'viewer cannot change permissions');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.manage_tree_member(current_setting('app.test_tree')::uuid,current_setting('app.test_relative')::uuid,'editor')$$,
  'owner can promote a viewer to editor');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}';
insert into public.collaboration_comments(tree_id,person_id,body)
values(current_setting('app.test_tree')::uuid,current_setting('app.test_person')::uuid,'Relative’s source observation');
select is((select author_id from public.collaboration_comments),auth.uid(),'comment author comes from the authenticated session');
select throws_ok($$insert into public.collaboration_comments(tree_id,person_id,body,author_id)
 values(current_setting('app.test_tree')::uuid,current_setting('app.test_person')::uuid,'Fake author','10000000-0000-4000-8000-000000000001')$$,
 '42501',null,'editor cannot spoof a comment author');
insert into fixtures values ('correction',
  public.propose_tree_review(current_setting('app.test_tree')::uuid,'people',current_setting('app.test_person')::uuid,
  'biography','Proposed biography','Compare the family register')::text);
insert into fixtures values ('dispute',
  public.propose_tree_review(current_setting('app.test_tree')::uuid,'parent_child_relationships',current_setting('app.test_relationship')::uuid,
  'verification_status','','The register may refer to a different person')::text);
select is((select verification_status::text from public.parent_child_relationships where id=current_setting('app.test_relationship')::uuid),
  'disputed','a dispute immediately marks a relationship disputed');
select throws_ok($$update public.parent_child_relationships set verification_status='verified'
 where id=current_setting('app.test_relationship')::uuid$$,
 '23514',null,'a normal edit cannot clear an active dispute');
select throws_ok($$select public.resolve_tree_review((select value::uuid from fixtures where key='dispute'),'unverified','')$$,
  '42501',null,'only the owner can resolve an open review');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(exists(select 1 from jsonb_array_elements(public.get_tree_collaboration(current_setting('app.test_tree')::uuid)->'changes') entry
  where entry->>'actorId'=current_setting('app.test_relative') and entry->>'entity'='collaboration_comments'
    and entry->>'at' is not null and (entry->>'unread')::boolean), 'owner sees attributed, timestamped unread activity');
select lives_ok($$select public.mark_tree_updates_read(current_setting('app.test_tree')::uuid,now())$$,'owner can acknowledge updates');
select ok(not exists(select 1 from jsonb_array_elements(public.get_tree_collaboration(current_setting('app.test_tree')::uuid)->'changes') entry
  where (entry->>'unread')::boolean), 'read checkpoint clears existing notices');
select throws_ok($$select public.resolve_tree_review((select value::uuid from fixtures where key='correction'),'apply','','2000-01-01')$$,
  'P0002',null,'stale review cannot overwrite a newer record');
select lives_ok($$select public.resolve_tree_review((select value::uuid from fixtures where key='correction'),'apply','Checked source',
  (public.inspect_tree_review((select value::uuid from fixtures where key='correction'))->>'version')::timestamptz)$$,
  'owner explicitly applies a reviewed correction');
select is((select biography from public.people where id=current_setting('app.test_person')::uuid),
  'Proposed biography','approved correction updated the person');
select throws_ok($$select public.save_versioned_family_connection(current_setting('app.test_tree')::uuid,
  current_setting('app.test_person')::uuid,jsonb_build_object('id',current_setting('app.test_relationship'),'category','parent'),'2000-01-01')$$,
  'P0002',null,'stale relationship editor cannot overwrite a newer version');
select lives_ok($$select public.resolve_tree_review((select value::uuid from fixtures where key='dispute'),'unverified','More evidence needed',
  (public.inspect_tree_review((select value::uuid from fixtures where key='dispute'))->>'version')::timestamptz)$$,
  'owner can resolve a disputed link as unverified');
select lives_ok($$select public.manage_tree_member(current_setting('app.test_tree')::uuid,current_setting('app.test_relative')::uuid,'editor',true)$$,
  'owner can revoke access');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}';
select is((select count(*) from public.people),0::bigint,'revocation blocks private records immediately');
select is((select count(*) from public.collaboration_comments),0::bigint,'revocation blocks private discussions immediately');
select throws_ok($$select public.respond_to_tree_invitation((select value::uuid from fixtures where key='invitation'),true)$$,
  '42501',null,'accepted invitation cannot restore revoked access');

reset role;
update auth.users set email_confirmed_at=now() where id='10000000-0000-4000-8000-000000000012';
update public.tree_invitations set expires_at=now()-interval '1 day' where id=(select value::uuid from fixtures where key='unverified');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000012","role":"authenticated"}';
select throws_ok($$select public.respond_to_tree_invitation((select value::uuid from fixtures where key='unverified'),true)$$,
  '42501',null,'verified email cannot use an expired invitation');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into fixtures values ('decline', public.request_tree_invitation(current_setting('app.test_tree')::uuid,
  'relative@example.invalid','editor',true)->>'id');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}';
select lives_ok($$select public.respond_to_tree_invitation((select value::uuid from fixtures where key='decline'),false)$$,
  'a verified recipient can decline');
select is((select count(*) from public.people),0::bigint,'declining does not grant access');
select throws_ok($$select public.respond_to_tree_invitation((select value::uuid from fixtures where key='decline'),true)$$,
  '42501',null,'a declined invitation cannot later be accepted');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into fixtures values ('cancel',public.request_tree_invitation(current_setting('app.test_tree')::uuid,
  'relative@example.invalid','editor',true)->>'id');
select lives_ok($$select public.cancel_tree_invitation(current_setting('app.test_tree')::uuid,
  (select value::uuid from fixtures where key='cancel'))$$,'owner can cancel a pending invitation');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated"}';
select is((select count(*) from public.list_my_tree_invitations()),0::bigint,'the inbox omits cancelled invitations');
select throws_ok($$select public.respond_to_tree_invitation((select value::uuid from fixtures where key='cancel'),true)$$,
  '42501',null,'a cancelled invitation cannot grant access');

select * from finish();
rollback;
