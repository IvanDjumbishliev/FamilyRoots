begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok($$insert into people(id, tree_id, display_name, is_draft)
values ('30000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000001', 'Unnamed draft', true)$$,
'editor can create a draft without sensitive details');
select lives_ok($$update people set display_name='Ari Moreau', given_names='Ari', surnames='Moreau',
  alternative_names=array['Ari Dubois'], birth_date='1930-01-01', birth_date_precision='year',
  birth_date_approximate=true, is_draft=false
where id = '30000000-0000-4000-8000-000000000020'$$, 'editor can complete a draft with a partial and approximate date');
select ok((select changed_fields @> array['birth_date','is_draft'] from activity_logs
where entity_id = '30000000-0000-4000-8000-000000000020' and operation = 'update'),
'audit entry records changed field names');

select throws_ok($$update people set birth_date='1930-04-22' where id='30000000-0000-4000-8000-000000000020'$$,
'23514', null, 'year precision rejects hidden month and day');
select throws_ok($$update people set birth_date_approximate=false, death_date='1929-01-01', death_date_precision='year'
where id='30000000-0000-4000-8000-000000000020'$$, '23514', null, 'exact date ranges reject death preceding birth');
select throws_ok($$update people set living_status='living', death_place='Lyon' where id='30000000-0000-4000-8000-000000000020'$$,
'23514', null, 'living profiles cannot contain death details');

select lives_ok($$select add_person_source('20000000-0000-4000-8000-000000000001',
'30000000-0000-4000-8000-000000000020', 'Fictional registry', '', 'p. 4')$$, 'source without an external URL can be attached');
select is((select count(*) from activity_logs where entity_id='30000000-0000-4000-8000-000000000020'
and changed_fields = array['sources']), 1::bigint, 'source attachment appears in profile audit');
select throws_ok($$select add_person_source('20000000-0000-4000-8000-000000000001',
'30000000-0000-4000-8000-000000000020', 'Invalid URL', 'javascript:alert(1)', '')$$, '23514', null,
'non-web source URLs are rejected');
select throws_ok($$select attach_person_photo('20000000-0000-4000-8000-000000000001',
'30000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000001/missing.png','missing.png','image/png',8)$$,
'23514', null, 'photo attachment requires an existing private object');

select lives_ok($$insert into storage.objects(bucket_id,name,metadata) values ('family-media',
'20000000-0000-4000-8000-000000000001/profile.png','{"mimetype":"image/png","size":8}')$$,
'editor can upload a tree-scoped profile object');
select lives_ok($$select attach_person_photo('20000000-0000-4000-8000-000000000001',
'30000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000001/profile.png','profile.png','image/png',8)$$,
'photo attachment links media and person atomically');
select throws_ok($$update people set profile_photo_id=(select profile_photo_id from people where id='30000000-0000-4000-8000-000000000020')
where id='30000000-0000-4000-8000-000000000001'$$, '23503', null, 'photo must belong to the same person');

select lives_ok($$update people set archived_at=now() where id='30000000-0000-4000-8000-000000000020'$$, 'editor can archive a person');
select is((select count(*) from source_citations where person_id='30000000-0000-4000-8000-000000000020'), 1::bigint,
'archive preserves citations');
select is((select count(*) from activity_logs where entity_id='30000000-0000-4000-8000-000000000020'
and changed_fields @> array['archived_at']), 1::bigint, 'archive is audited');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
with changed as (update people set archived_at=null where id='30000000-0000-4000-8000-000000000020' returning id)
select is((select count(*) from changed), 0::bigint, 'viewer cannot restore or edit a record');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*) from people where id='30000000-0000-4000-8000-000000000020'), 0::bigint, 'another tree cannot read this profile');
select is((select count(*) from storage.objects where name like '%/profile.png'), 0::bigint, 'another tree cannot read its photograph');

reset role;
select * from finish();
rollback;
