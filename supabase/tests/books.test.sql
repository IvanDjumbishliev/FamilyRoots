begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select set_config('app.book_tree','20000000-0000-4000-8000-000000000001',true);
select set_config('app.book_owner','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.create_family_book(current_setting('app.book_tree')::uuid,'{"title":"Book","privacy":"private"}')$$,
 '42501',null,'a viewer cannot queue a book');
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.create_family_book(current_setting('app.book_tree')::uuid,'{"title":"Book","privacy":"full","consent":false}')$$,
 '22023',null,'full editions require consent');
select throws_ok($$select public.create_family_book(current_setting('app.book_tree')::uuid,
 '{"title":"Book","privacy":"private","branch":"30000000-0000-4000-8000-000000000003"}')$$,
 '42501',null,'branch cannot reference a foreign tree');
select set_config('app.book_id',public.create_family_book(current_setting('app.book_tree')::uuid,
 '{"title":"Book","privacy":"private","branch":null,"events":[],"media":[],"biographies":[]}')::text,true);
select is((select status from public.family_books where id=current_setting('app.book_id')::uuid),'queued','a new draft is queued');
select throws_ok($$select * from public.claim_family_book(null)$$,'42501',null,'clients cannot claim worker jobs');

reset role;
set local role service_role;
select set_config('app.book_lease',(select lease::text from public.claim_family_book(current_setting('app.book_id')::uuid)),true);
select is((select count(*) from public.claim_family_book(current_setting('app.book_id')::uuid)),0::bigint,'a live lease prevents duplicate work');
select is(jsonb_array_length(public.get_family_book_context(current_setting('app.book_id')::uuid,
 current_setting('app.book_lease')::uuid)->'people'),1,'safe edition excludes unknown-status profiles');
select ok(not public.finish_family_book(current_setting('app.book_id')::uuid,gen_random_uuid(),'[]'),
 'stale worker cannot publish a result');
select ok(public.finish_family_book(current_setting('app.book_id')::uuid,current_setting('app.book_lease')::uuid,
 '[{"key":"introduction","title":"Introduction","paragraphs":["Draft"]}]'),
 'current worker can complete a draft');

reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public.family_books),0::bigint,'collaborators cannot see the creator’s private books');
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.queue_family_book(current_setting('app.book_id')::uuid,1,'pdf')$$,
 '22023',null,'PDF export requires a privacy and rights review confirmation');
select lives_ok($$select public.edit_family_book_section(current_setting('app.book_id')::uuid,1,'introduction','Edited')$$,
 'creator can edit a completed draft section');
select throws_ok($$select public.edit_family_book_section(current_setting('app.book_id')::uuid,1,'introduction','Stale text')$$,
 'P0002',null,'stale edits do not overwrite newer edits');

-- Phase 16: Draft Saving & Revision History Tests
select lives_ok($$select public.save_family_book_draft(
  current_setting('app.book_id')::uuid,
  2,
  '{"title":"Updated Title","subtitle":"Sub","author":"Author","privacy":"private","template":"vintage-archive","theme":"sepia"}',
  '[{"key":"introduction","title":"Intro","paragraphs":["Custom Introduction"]},{"key":"closing","title":"Closing","paragraphs":["End"]}]'
)$$, 'creator can save customized draft content and settings');

select is((select revision from public.family_books where id=current_setting('app.book_id')::uuid),3,'saving draft increments revision');
select is((select settings->>'template' from public.family_books where id=current_setting('app.book_id')::uuid),'vintage-archive','template persists in draft settings');
select is((select count(*) from public.family_book_revisions where book_id=current_setting('app.book_id')::uuid),1::bigint,'revision history is maintained');

select lives_ok($$select public.queue_family_book(current_setting('app.book_id')::uuid,3,'pdf',null,true)$$,'creator can queue PDF generation');

reset role;
set local role service_role;
select set_config('app.book_lease',(select lease::text from public.claim_family_book(current_setting('app.book_id')::uuid)),true);
select ok(public.finish_family_book(current_setting('app.book_id')::uuid,current_setting('app.book_lease')::uuid,null,null,'Render failed'),
 'worker can record generation failures');
reset role;
set local role authenticated;
select is((select error from public.family_books where id=current_setting('app.book_id')::uuid),'Render failed','creator can read worker errors');
select lives_ok($$select public.queue_family_book(current_setting('app.book_id')::uuid,4,'retry')$$,'creator can retry a failed job');
select is((select operation from public.family_books where id=current_setting('app.book_id')::uuid),'pdf','retry keeps the failed operation');
select * from finish();
rollback;
