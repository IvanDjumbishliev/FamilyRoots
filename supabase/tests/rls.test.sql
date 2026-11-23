begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relrowsecurity and c.relname in (
     'profiles', 'family_trees', 'tree_memberships', 'people', 'parent_child_relationships',
     'partnerships', 'life_events', 'media_assets', 'sources', 'source_citations', 'activity_logs'
   )), 11::bigint, 'all application tables have RLS enabled'
);
select is((select public from storage.buckets where id = 'family-media'), false, 'family media bucket is private');

set local role anon;
select throws_ok('select * from public.people', '42501', null, 'anonymous users have no people table access');
select is((select count(*) from storage.objects where bucket_id = 'family-media'), 0::bigint, 'anonymous users see no objects');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.profiles), 1::bigint, 'the owner sees only their own profile');
select is((select count(*) from public.family_trees), 1::bigint, 'owner sees only their own tree');
select is((select count(*) from public.people), 2::bigint, 'owner reads their tree records');
select is((select count(*) from public.tree_memberships), 3::bigint, 'owner can list memberships');
select lives_ok($$insert into public.family_trees (id, name)
  values ('20000000-0000-4000-8000-000000000003', 'New tree') returning id$$, 'owner can create and return a tree');
select is((select role::text from public.tree_memberships where tree_id = '20000000-0000-4000-8000-000000000003'),
  'owner', 'creating a tree creates the owner membership');
select throws_ok($$update public.family_trees set owner_id = '10000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'owner cannot transfer the tree using a client update');
select throws_ok($$update public.tree_memberships set role = 'owner' where role = 'viewer'$$,
  '42501', null, 'owner cannot assign the owner role to another user');
select lives_ok($$insert into storage.objects (bucket_id, name) values
  ('family-media', '20000000-0000-4000-8000-000000000001/document.txt')$$, 'owner can store media under their tree prefix');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('family-media', 'invalid/document.txt')$$,
  '42501', null, 'malformed prefixes are denied without a UUID cast error');
select throws_ok($$insert into storage.objects (bucket_id, name) values
  ('family-media', '20000000-0000-4000-8000-000000000002/document.txt')$$,
  '42501', null, 'owner cannot upload under another tree prefix');
select throws_ok($$insert into public.activity_logs (tree_id, operation, entity_type, entity_id)
  values ('20000000-0000-4000-8000-000000000001', 'insert', 'people', gen_random_uuid())$$,
  '42501', null, 'audit rows cannot be fabricated by clients');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public.people), 2::bigint, 'editor sees only records in their shared tree');
select lives_ok($$insert into public.people (id, tree_id, display_name) values
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Editor addition')$$,
  'editor can add records to shared tree');
select is((select actor_id::text from public.activity_logs where entity_id = '30000000-0000-4000-8000-000000000005'),
  '10000000-0000-4000-8000-000000000002', 'write generated the authenticated actor audit event');
with change as (update public.family_trees set name = 'Illegal rename' returning id)
select is((select count(*) from change),
  0::bigint, 'editor cannot rename the tree');
with change as (update public.tree_memberships set role = 'owner' returning id)
select is((select count(*) from change),
  0::bigint, 'editor cannot escalate their role');
select throws_ok($$insert into public.tree_memberships (tree_id, user_id, role)
  values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'editor')$$,
  '42501', null, 'editor cannot grant membership');
select throws_ok($$insert into public.parent_child_relationships (tree_id, parent_id, child_id, kind)
  values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000001', 'adoptive')$$,
  '23503', null, 'composite keys forbid linking people from separate trees');
select throws_ok($$insert into public.parent_child_relationships
  (tree_id, parent_id, child_id, kind, provenance, verification_status)
  values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000005', 'step', 'ai_suggested', 'verified')$$,
  '23514', null, 'AI suggestions cannot be accepted as verified');
select throws_ok($$insert into public.source_citations (tree_id, source_id, person_id)
  values ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000003')$$, '23503', null, 'citations cannot target a different tree');
select throws_ok($$delete from public.people where id = '30000000-0000-4000-8000-000000000003'$$, '42501', null, 'editor cannot delete another family’s record');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from public.people), 3::bigint, 'viewer reads shared records');
select is((select count(*) from storage.objects where bucket_id = 'family-media'), 1::bigint, 'viewer reads shared storage metadata');
select throws_ok($$insert into storage.objects (bucket_id, name) values
  ('family-media', '20000000-0000-4000-8000-000000000001/viewer.txt')$$,
  '42501', null, 'viewer cannot upload objects');
select throws_ok($$insert into public.people (tree_id, display_name)
  values ('20000000-0000-4000-8000-000000000001','Viewer addition')$$,
  '42501', null, 'viewer cannot insert records');
with change as (update public.people set display_name = 'Changed' returning id)
select is((select count(*) from change),
  0::bigint, 'viewer cannot update records');
select throws_ok($$delete from public.people$$, '42501', null, 'viewer cannot delete records');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select display_name from public.people), 'Marisol Rivera', 'outsider sees only their own tree');
select is((select count(*) from public.source_citations), 0::bigint, 'outsider cannot see citations');
select is((select count(*) from storage.objects where bucket_id = 'family-media'), 0::bigint, 'outsider cannot list another family’s storage');
select throws_ok($$insert into public.people (tree_id, display_name)
  values ('20000000-0000-4000-8000-000000000001','Outsider addition')$$,
  '42501', null, 'outsider cannot insert into another family’s tree');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
with removed as (delete from public.tree_memberships where role = 'viewer' returning id)
select is((select count(*) from removed),
  1::bigint, 'owner can revoke a viewer');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from public.people), 0::bigint, 'revoked membership immediately loses database access');
select is((select count(*) from storage.objects where bucket_id = 'family-media'), 0::bigint, 'revoked membership loses storage listing access');

reset role;
select * from finish();
rollback;
