begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, aud, role, email)
values ('10000000-0000-4000-8000-000000000099', 'authenticated', 'authenticated', 'onboarding-fixture@example.invalid');

set local role anon;
select throws_ok($$select complete_family_onboarding('Anonymous', 'Private')$$, '42501', null, 'anonymous onboarding is rejected');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000099","role":"authenticated"}';
select throws_ok($$select complete_family_onboarding('New Relative', '   ')$$, '23514', null, 'tree name required on first setup');
select is((select display_name from profiles), '', 'failure rolls back display name update');
select lives_ok($$select complete_family_onboarding('New Relative', 'New Family')$$, 'first setup creates a tree');
select lives_ok($$select complete_family_onboarding('New Relative', 'Duplicate')$$, 'onboarding can be retried');
select is((select count(*) from family_trees), 1::bigint, 'retry does not create another tree');
select is((select role::text from tree_memberships), 'owner', 'new account owns its first tree');
update profiles set preferred_language = 'bg';
select is((select preferred_language from profiles), 'bg', 'account may update its own language');

reset role;
select * from finish();
rollback;
