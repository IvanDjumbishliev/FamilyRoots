begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table transfers (key text primary key, payload jsonb);
grant all on transfers to authenticated;
insert into transfers values ('batch', '{
  "people":[
    {"ref":"@I1@","name":"GEDCOM Parent","given":"GEDCOM","surname":"Parent","aliases":[],"status":"deceased",
     "birth":{"date":"1890-01-01","precision":"year","approximate":true},"death":{"date":null,"precision":"unknown","approximate":false},
     "notes":"A private note mentions a living relative","citations":[{"source":"@S1@","page":"Page 4"}]},
    {"ref":"@I2@","name":"GEDCOM Child","aliases":[],"status":"living",
     "birth":{"date":null,"precision":"unknown","approximate":false},"death":{"date":null,"precision":"unknown","approximate":false}}
  ],
  "parents":[{"parent":"@I1@","child":"@I2@","kind":"adoptive"}],
  "partners":[],
  "sources":[{"ref":"@S1@","title":"GEDCOM Ledger","notes":"Transcription notes"}],
  "events":[{"people":["@I1@","@I2@"],"type":"residence","title":"GEDCOM Shared move","when":{"date":"1940-04-01","precision":"month","approximate":false},
     "citations":[{"source":"@S1@","page":"Page 9","notes":"Margin entry"}]}]
}'::jsonb);
select set_config('app.gedcom_tree','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.import_gedcom(current_setting('app.gedcom_tree')::uuid,(select payload from transfers where key='batch'),'{}')$$,
  '42501',null,'viewer cannot import');
select throws_ok($$select public.export_gedcom(current_setting('app.gedcom_tree')::uuid,true)$$,
  '42501',null,'viewer cannot export');
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.export_gedcom(current_setting('app.gedcom_tree')::uuid,false)$$,
  '42501',null,'outsider cannot export another tree');

set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into transfers values ('imported',
  public.import_gedcom(current_setting('app.gedcom_tree')::uuid,(select payload from transfers where key='batch'),'{"@I1@":"create","@I2@":"create"}','80000000-0000-4000-8000-000000000011'));
select is((select payload->>'created' from transfers where key='imported'),'2','editor imports two people');
select is(public.import_gedcom(current_setting('app.gedcom_tree')::uuid,(select payload from transfers where key='batch'),
  '{"@I1@":"create","@I2@":"create"}','80000000-0000-4000-8000-000000000011'),
  (select payload from transfers where key='imported'),'retry returns the saved receipt without writing another batch');
select throws_ok($$select public.import_gedcom(current_setting('app.gedcom_tree')::uuid,(select payload from transfers where key='batch'),
  '{"@I1@":"skip","@I2@":"create"}','80000000-0000-4000-8000-000000000011')$$,
  '22023',null,'request identifiers cannot be reused for different choices');
select is((select payload->>'relationships' from transfers where key='imported'),'1','one family connection imported');
select is((select payload->>'events' from transfers where key='imported'),'1','one shared event imported');
select is((select count(*) from public.life_event_people l join public.life_events e on l.event_id=e.id where e.title='GEDCOM Shared move'),
  2::bigint,'event retains both participants');
select is((select count(*) from public.source_citations c join public.sources s on c.source_id=s.id where s.title='GEDCOM Ledger'),
  2::bigint,'person and event retain their evidence');
select is((select count(*) from public.activity_logs where actor_id=auth.uid() and entity_type='people' and operation='insert'),
  2::bigint,'important edits are attributed to the importing editor');

insert into transfers values ('choices', jsonb_build_object('@I1@',(select id from public.people where display_name='GEDCOM Parent'),
  '@I2@',(select id from public.people where display_name='GEDCOM Child')));
insert into transfers values ('merged',public.import_gedcom(current_setting('app.gedcom_tree')::uuid,
  (select payload from transfers where key='batch'),(select payload from transfers where key='choices')));
select is((select payload->>'merged' from transfers where key='merged'),'2','repeat import can merge into existing records');
select is((select payload->>'skipped' from transfers where key='merged'),'3','repeat import skips duplicate link, source and event');
select is((select count(*) from public.source_citations c join public.sources s on c.source_id=s.id where s.title='GEDCOM Ledger'),
  2::bigint,'repeat import does not duplicate citations');

insert into transfers values ('bad',public.import_gedcom(current_setting('app.gedcom_tree')::uuid,
  jsonb_set((select payload from transfers where key='batch'),'{parents}',
    '[{"parent":"@I1@","child":"@I2@","kind":"adoptive"},{"parent":"@I2@","child":"@I1@","kind":"adoptive"}]'),
  '{"@I1@":"create","@I2@":"create"}'));
select is((select payload->>'failed' from transfers where key='bad'),'1','ancestry cycle produces a failed-record summary');
select matches((select payload->>'error' from transfers where key='bad'),'ancestry cycle','cycle error is understandable');
select is((select count(*) from public.people where display_name like 'GEDCOM %'),2::bigint,'failed transaction leaves no extra people');

set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into transfers values
  ('private',public.export_gedcom(current_setting('app.gedcom_tree')::uuid,true)),
  ('full',public.export_gedcom(current_setting('app.gedcom_tree')::uuid,false));
select ok((select payload::text not like '%GEDCOM Child%' and payload::text not like '%A private note%'
  and payload::text not like '%GEDCOM Ledger%' and payload::text not like '%GEDCOM Shared move%' from transfers where key='private'),
  'deceased-only mode strips living profiles and potentially identifying notes, sources and events');
select ok((select payload::text like '%GEDCOM Child%' and payload::text like '%GEDCOM Ledger%'
  and payload::text like '%GEDCOM Shared move%' and payload::text like '%adoptive%' from transfers where key='full'),
  'full export includes supported relationships and evidence');

select * from finish();
rollback;
