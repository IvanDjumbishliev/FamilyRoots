begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

set local role service_role;
select throws_ok($$select claim_archive_upload(
  '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',
  repeat('0',64),'letter.txt','text/plain',20,20,false,'{"title":"Viewer letter"}','{}')$$,
'42501',null,'the ingest function rejects a viewer even when called by the server');
select throws_ok($$select claim_archive_upload(
  '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  repeat('a',64),'letter.txt','text/plain',20,20,false,'{"title":"Wrong tree"}',
  array['30000000-0000-4000-8000-000000000003'::uuid])$$,
'23503',null,'archive person links must belong to the same tree');
select is((select count(*) from archive_items where sha256=repeat('a',64)),0::bigint,'failed claims roll back');
select lives_ok($$select claim_archive_upload(
  '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  repeat('1',64),'letter.txt','text/plain',20,20,false,'{"title":"Family letter","collection":"Correspondence"}',
  array['30000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000002'::uuid])$$,
'authorized editor can reserve an upload with two people');
select is((select claim_archive_upload(
  '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  repeat('1',64),'letter.txt','text/plain',20,20,false,'{"title":"Ignored title"}','{}')->>'pending'),
'true','a concurrent duplicate is pending');

reset role;
insert into storage.objects(bucket_id,name)
select 'family-archive', object_path from archive_items where sha256=repeat('1',64);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from archive_items),0::bigint,'pending uploads are invisible');
select is((select count(*) from storage.objects where bucket_id='family-archive'),0::bigint,'pending objects are invisible');
select throws_ok($$insert into storage.objects(bucket_id,name)
values('family-archive','20000000-0000-4000-8000-000000000001/unvalidated.txt')$$,
'42501',null,'authenticated clients cannot bypass server file validation');

reset role;
set local role service_role;
update archive_items set state='ready' where sha256=repeat('1',64);
select is((select claim_archive_upload(
  '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  repeat('1',64),'renamed.txt','text/plain',20,20,false,'{"title":"Ignored title"}','{}')->>'duplicate'),
'true','matching hashes identify the existing archive item');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select title from archive_items),'Family letter','viewer reads the original metadata after deduplication');
select is((select count(*) from archive_item_people),2::bigint,'viewer reads both associated people');
select is((select count(*) from storage.objects where bucket_id='family-archive'),1::bigint,'viewer can read the ready private object');
select throws_ok($$select update_archive_item((select id from archive_items),'{"title":"Viewer edit"}','{}')$$,
'42501',null,'viewer cannot update the archive item');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*) from archive_items),0::bigint,'outsider sees no archive metadata');
select is((select count(*) from storage.objects where bucket_id='family-archive'),0::bigint,'outsider sees no archived objects');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select update_archive_item(
  (select id from archive_items),'{"title":"Edited letter","recordedOn":"1910-01-01","precision":"year","approximate":true}',
  array['30000000-0000-4000-8000-000000000001'::uuid])$$,'owner can update metadata and replace links atomically');
select is((select updated_by::text from archive_items),'10000000-0000-4000-8000-000000000001','last editor is recorded');
select is((select count(*) from activity_logs where entity_type='archive_items'),2::bigint,'upload and edit are audited');

reset role;
set local role service_role;
select throws_ok($$select remove_archive_item((select id from archive_items where sha256=repeat('1',64)),
 '10000000-0000-4000-8000-000000000003')$$, '42501',null,'viewer cannot remove files');
select lives_ok($$select remove_archive_item((select id from archive_items where sha256=repeat('1',64)),
 '10000000-0000-4000-8000-000000000002')$$,'editor can remove their own upload');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from archive_items),0::bigint,'removed item is immediately hidden');
select is((select count(*) from storage.objects where bucket_id='family-archive'),0::bigint,'removed object cannot be signed');

reset role;
select * from finish();
rollback;
