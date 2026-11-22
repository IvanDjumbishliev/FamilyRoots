-- Fictional data only. The fixed identities have no password and cannot sign in.
-- RLS tests exercise them by switching roles and JWT claims within a transaction.
insert into auth.users (id, aud, role, email)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sample-owner@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sample-editor@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sample-viewer@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'sample-outsider@example.invalid');

update public.profiles set display_name = 'Sample Owner'
where id = '10000000-0000-4000-8000-000000000001';
insert into public.family_trees (id, owner_id, name)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'The Moreau family'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'The Rivera family');
insert into public.tree_memberships (tree_id, user_id, role) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'editor'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'viewer');
insert into public.people (id, tree_id, display_name, living_status, birth_date, birth_date_precision, birth_date_approximate)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Rosa Moreau', 'deceased', '1912-01-01', 'year', true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Lucien Moreau', 'unknown', null, 'unknown', false),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Marisol Rivera', 'living', null, 'unknown', false);
insert into public.parent_child_relationships (id, tree_id, parent_id, child_id, kind, provenance)
values ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'biological', 'documented');
insert into public.sources (id, tree_id, title, rights_note)
values ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  'Fictional Moreau register', 'Synthetic development fixture');
insert into public.source_citations (tree_id, source_id, relationship_id)
values ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001');
insert into public.life_events (tree_id, person_id, event_type, title, occurred_on, date_precision)
values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
  'residence', 'Rosa moved to Lyon', '1956-01-01', 'year');
