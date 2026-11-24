begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select set_config('app.research_tree','20000000-0000-4000-8000-000000000001',true);
select set_config('app.research_person','30000000-0000-4000-8000-000000000001',true);
select set_config('app.research_relative','30000000-0000-4000-8000-000000000002',true);
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from public.search_fictional_historical_records('Ada Valette','montreal',1899,1901,'census')),
  1::bigint,'provider filters by normalized name, place, range, and record type');
select ok((select r->>'collection' like 'Fictional%' and r->>'license'='CC0-1.0' and r->>'retrievedAt' is not null
  and r->>'url' like 'https://%' and (r->>'fictional')::boolean
  from public.search_fictional_historical_records('Ines Duarte','Halifax',1902,1902,'migration') r),
  'fictional search result includes canonical collection, attribution, URL, license, and retrieval time');
select throws_ok($$select * from public.search_fictional_historical_records('Ada Valette','',2024,2026,'all')$$,
  '22023',null,'recent records are unavailable from the mock provider');
select throws_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872','save')$$,
 '42501',null,'viewer cannot modify saved research');
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'made-up-from-client','save')$$,
 '22023',null,'a client cannot inject provider records');
select throws_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872',
 'attach','30000000-0000-4000-8000-000000000003')$$,'42501',null,'evidence cannot be attached to another tree');
select lives_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872','save')$$,
 'editor can save a fixture');
select lives_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872','reject',
 current_setting('app.research_person')::uuid)$$,'editor can reject a suggested match');
select is((select status from public.research_matches),'rejected','rejection is durable');
select lives_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872','hypothesis',
 current_setting('app.research_person')::uuid,current_setting('app.research_relative')::uuid,'parent')$$,'editor can record a hypothesis');
select is((select status from public.research_matches),'unverified','research hypothesis starts unverified');
select throws_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872','verified',
 current_setting('app.research_person')::uuid)$$,'22023',null,'verified is not a research action');
select is((select count(*) from public.parent_child_relationships),1::bigint,'discovery creates no ancestry edges');
select lives_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872','attach',
 current_setting('app.research_person')::uuid)$$,'editor attaches a fictional citation');
select lives_ok($$select public.update_fictional_research(current_setting('app.research_tree')::uuid,'valette-1872','attach',
 current_setting('app.research_person')::uuid)$$,'repeat attachment is safe');
select is((select count(*) from public.source_citations where person_id=current_setting('app.research_person')::uuid),
 1::bigint,'attachment creates one person citation');
select is((select hypothesis from public.research_matches),'parent','attachment retains the unverified hypothesis');
select is((select count(*) from public.activity_logs where entity_type='research_matches' and actor_id=auth.uid()),
 3::bigint,'research decisions are attributed to their editor');
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*) from public.research_findings),0::bigint,'outsider cannot read a saved finding');
select is((select count(*) from public.research_matches),0::bigint,'outsider cannot read research decisions');

reset role;
insert into familyroots_private.discovery_rate_windows(provider,user_id,window_start,requests)
  values('fictional-archive','10000000-0000-4000-8000-000000000002',date_trunc('minute',clock_timestamp()),20);
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select * from public.search_fictional_historical_records('Ada','',1600,1925,'all')$$,
  'P0001',null,'per-account provider rate limit is enforced');
select * from finish();
rollback;
