begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',
 '{"category":"parent","direction":"child","kind":"adoptive","newName":"Ari Moreau","provenance":"documented"}')$$,
 'editor can create a person and adoption in one transaction');
select is((select count(*) from parent_child_relationships join people on people.id = child_id
 where kind = 'adoptive' and display_name = 'Ari Moreau'), 1::bigint, 'adoptive edge is stored');

select throws_ok($$insert into parent_child_relationships(tree_id,parent_id,child_id,kind)
 select tree_id,id,'30000000-0000-4000-8000-000000000001','step' from people where display_name='Ari Moreau'$$,
 '23514', 'Ancestry cycle', 'server rejects a three-person cycle even when an edge is a step link');
select lives_ok($$insert into parent_child_relationships(tree_id,parent_id,child_id,kind)
 select tree_id,'30000000-0000-4000-8000-000000000001',id,'guardian' from people where display_name='Ari Moreau'$$,
 'direct connection can coexist with the longer ancestry route');
select throws_ok($$update parent_child_relationships set parent_id=child_id, child_id=parent_id
 where kind='guardian' and parent_id='30000000-0000-4000-8000-000000000001'$$,
 '23514', 'Ancestry cycle', 'editing an existing edge cannot create a cycle');
delete from parent_child_relationships where kind='guardian' and parent_id='30000000-0000-4000-8000-000000000001';

select throws_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002', '{"category":"parent","direction":"child","kind":"unsupported","newName":"Rollback person"}')$$,
 '22P02', null, 'invalid connection fails');
select is((select count(*) from people where display_name='Rollback person'), 0::bigint, 'failed connection rolls back the newly created person');

select lives_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',
 '{"category":"partnership","kind":"marriage","status":"former","targetId":"30000000-0000-4000-8000-000000000001","endedOn":"1980-01-01","endPrecision":"year","endApproximate":true}')$$,
 'former partnership retains partial approximate end date');
select lives_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',
 '{"category":"partnership","kind":"civil_union","status":"current","newName":"New partner"}')$$,
 'a person can have another partnership');
select is((select count(*) from partnerships where '30000000-0000-4000-8000-000000000002' in (person_a_id,person_b_id)),
 2::bigint, 'both partnerships persist');

select lives_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',
 jsonb_build_object('id', r.id,'targetId', r.child_id,'category','parent','direction','child','kind','guardian'))
 from parent_child_relationships r where kind='adoptive'$$, 'editor can change a relationship type');
select is((select count(*) from parent_child_relationships where kind='guardian'), 1::bigint, 'updated type is stored');

select lives_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',
 '{"category":"other","kind":"Godparent connection","provenance":"documented","targetId":"30000000-0000-4000-8000-000000000001"}')$$,
 'other documented connections have their own normalized records');
select throws_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002',
 '{"category":"other","kind":"Other","targetId":"30000000-0000-4000-8000-000000000003"}')$$,
 '42501', null, 'connection cannot link a person from another tree');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from other_family_relationships), 1::bigint, 'viewer may read shared connections');
select throws_ok($$select save_family_connection('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002','{"category":"other","kind":"Other","newName":"Viewer creation"}')$$,
 '42501', null, 'viewer cannot use the relationship RPC to write');
with removed as (delete from other_family_relationships returning id)
select is((select count(*) from removed), 0::bigint, 'viewer cannot remove connections');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*) from other_family_relationships), 0::bigint, 'outsider cannot read private connections');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
with removed as (delete from other_family_relationships returning id)
select is((select count(*) from removed), 1::bigint, 'editor can remove a connection');

reset role;
select * from finish();
rollback;
