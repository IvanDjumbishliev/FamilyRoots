begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select set_config('app.assistant_tree','20000000-0000-4000-8000-000000000001',true);
select set_config('app.assistant_person','30000000-0000-4000-8000-000000000001',true);

update public.people set verification_status='verified' where id=current_setting('app.assistant_person')::uuid;
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(public.get_assistant_evidence(current_setting('app.assistant_tree')::uuid,
  array[current_setting('app.assistant_person')::uuid],'biography')->'people'->0->>'name','Rosa Moreau',
  'authorized viewer can read selected evidence');
select is(jsonb_array_length(public.get_assistant_evidence(current_setting('app.assistant_tree')::uuid,'{}','summary')->'people'),
  1,'tree overview returns verified profiles only');
select throws_ok($$select public.get_assistant_evidence(current_setting('app.assistant_tree')::uuid,
  array['30000000-0000-4000-8000-000000000003'::uuid],'biography')$$,
  '42501',null,'selected person must belong to the authorized tree');
select throws_ok($$select public.get_assistant_evidence(current_setting('app.assistant_tree')::uuid,
  array['30000000-0000-4000-8000-000000000001'::uuid],'relationship')$$,
  '22023',null,'relationship requires two distinct profiles');
select throws_ok($$select public.reserve_assistant_request(auth.uid(),true)$$,'42501',null,
  'clients cannot reserve live provider quota');
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.get_assistant_evidence(current_setting('app.assistant_tree')::uuid,'{}','summary')$$,
  '42501',null,'another tree member cannot access private family evidence');

reset role;
set local role service_role;
select ok(public.reserve_assistant_request('10000000-0000-4000-8000-000000000001',false),'service reserves an account request');
reset role;
insert into familyroots_private.assistant_limits values('live',(now() at time zone 'UTC')::date,200);
set local role service_role;
select is(public.reserve_assistant_request('10000000-0000-4000-8000-000000000001',true),false,'service enforces the global live quota');
reset role;
update familyroots_private.assistant_limits set used=20 where bucket='account:10000000-0000-4000-8000-000000000001';
set local role service_role;
select is(public.reserve_assistant_request('10000000-0000-4000-8000-000000000001',false),false,'service enforces the account quota');
select * from finish();
rollback;
