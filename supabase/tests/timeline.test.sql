begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

set local role service_role;
select claim_archive_upload('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 repeat('4',64),'timeline-letter.txt','text/plain',40,40,false,'{"title":"Timeline letter"}','{}');
update archive_items set state='ready' where sha256=repeat('4',64);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is((select count(*) from life_event_people where person_id='30000000-0000-4000-8000-000000000001'), 1::bigint,
 'legacy person ID is backfilled into the multiple-people table');
select lives_ok($$select save_timeline_event('20000000-0000-4000-8000-000000000001',
 jsonb_build_object('title','Timeline migration','type','migration','kind','family','verification','unverified',
 'date','1950-01-01','precision','year','approximate',true,'people',array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'],
 'items',array[(select id from archive_items where title='Timeline letter')],'sources',array['50000000-0000-4000-8000-000000000001']))$$,
 'editor creates approximate family event with multiple people, media and source');
select is((select count(*) from life_event_people p join life_events e on e.id=p.event_id where e.title='Timeline migration'),2::bigint,'both people are linked');
select is((select count(*) from life_event_archive_items p join life_events e on e.id=p.event_id where e.title='Timeline migration'),1::bigint,'supporting archive file is linked');
select is((select count(*) from source_citations p join life_events e on e.id=p.life_event_id where e.title='Timeline migration'),1::bigint,'source citation is linked');

select throws_ok($$select save_timeline_event('20000000-0000-4000-8000-000000000001',
 '{"title":"Invalid date","type":"birth","kind":"family","verification":"verified","precision":"month","date":"1950-02-05"}')$$,
 '23514',null,'month precision cannot carry a hidden day');
select throws_ok($$select save_timeline_event('20000000-0000-4000-8000-000000000001',
 '{"title":"Invalid context","type":"custom","kind":"context","verification":"verified","precision":"unknown"}')$$,
 '23514',null,'historical context cannot be marked as a verified family event');
select throws_ok($$select save_timeline_event('20000000-0000-4000-8000-000000000001',
 '{"title":"Cross-tree association","type":"migration","kind":"family","verification":"unverified","precision":"unknown",
 "people":["30000000-0000-4000-8000-000000000003"]}')$$,
 '23503',null,'events cannot link people in another tree');
select is((select count(*) from life_events where title='Cross-tree association'),0::bigint,'failed association rolls back event creation');

select throws_ok($$select save_timeline_event('20000000-0000-4000-8000-000000000001',
 jsonb_build_object('id',e.id,'version','2000-01-01','title','Stale edit','type','migration','kind','family','verification','unverified','precision','unknown'))
 from life_events e where title='Timeline migration'$$,'P0002',null,'stale edits cannot overwrite the current event');
select lives_ok($$select save_timeline_event('20000000-0000-4000-8000-000000000001',
 jsonb_build_object('id',e.id,'version',e.updated_at,'title','Updated migration','type','migration','kind','family','verification','unverified','precision','unknown'))
 from life_events e where title='Timeline migration'$$,'editing and unlinking work in one transaction');
select is((select count(*) from life_event_people p join life_events e on e.id=p.event_id where e.title='Updated migration'),0::bigint,'obsolete people links are removed');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from life_events where title='Updated migration'),1::bigint,'viewer can read a tree event');
select throws_ok($$select save_timeline_event('20000000-0000-4000-8000-000000000001','{}')$$,'42501',null,'viewer cannot edit events');
with gone as (delete from life_events where title='Updated migration' returning id)
select is((select count(*) from gone),0::bigint,'viewer cannot remove events');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*) from life_events where title='Updated migration'),0::bigint,'outsider cannot read a private family event');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
with gone as (delete from life_events where title='Updated migration' returning id)
select is((select count(*) from gone),1::bigint,'editor can remove the event');
select is((select count(*) from archive_items where title='Timeline letter'),1::bigint,'archive original is preserved');
select is((select count(*) from sources where id='50000000-0000-4000-8000-000000000001'),1::bigint,'source record is preserved');
reset role;
select * from finish();
rollback;
