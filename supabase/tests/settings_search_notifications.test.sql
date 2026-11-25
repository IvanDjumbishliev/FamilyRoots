begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select set_config('app.test_tree','20000000-0000-4000-8000-000000000001',true);
select set_config('app.test_user','10000000-0000-4000-8000-000000000001',true);
select set_config('app.other_user','10000000-0000-4000-8000-000000000002',true);

set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- 1. Test Preferences Upsert & Read
select lives_ok($$
  insert into public.user_preferences(user_id, notify_email, privacy_profile_visibility)
  values(current_setting('app.test_user')::uuid, true, 'members')
  on conflict (user_id) do update set notify_email = true, privacy_profile_visibility = 'members';
$$, 'authenticated user can upsert user_preferences');

select is((select notify_email from public.user_preferences where user_id = current_setting('app.test_user')::uuid), true, 'email preference saved');

-- 2. Test Notifications RLS
reset role;
set local role service_role;
insert into public.notifications(user_id, tree_id, category, title, body, link)
values(
  current_setting('app.test_user')::uuid,
  current_setting('app.test_tree')::uuid,
  'invitation',
  'Family invitation',
  'You have been invited to collaborate',
  '/invitations'
);

reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.notifications where user_id = current_setting('app.test_user')::uuid), 1::bigint, 'user can read their own notifications');

select lives_ok($$
  update public.notifications set read = true where user_id = current_setting('app.test_user')::uuid;
$$, 'user can update notification read status');

select is((select read from public.notifications where user_id = current_setting('app.test_user')::uuid), true, 'notification marked as read');

-- 3. Test Global Search Function
select lives_ok($$
  select * from public.global_search('sample', null, 'all', 10, 0);
$$, 'user can execute global search');

-- 4. Test Export Personal Data
select lives_ok($$
  select public.export_personal_data();
$$, 'user can export personal data');

select is(jsonb_typeof(public.export_personal_data()), 'object', 'export returns structured json');

-- 5. Test Account Deletion
select lives_ok($$
  select public.delete_user_account();
$$, 'user can trigger account deletion workflow');

select is((select count(*) from public.profiles where id = current_setting('app.test_user')::uuid), 0::bigint, 'profile removed after account deletion');

select * from finish();
rollback;
