-- Phase 19: Testing and Performance Optimization
-- Additional composite and partial indexes for high-volume trees, fast directory paging, and search queries

-- 1. People search and directory sorting performance
create index if not exists people_tree_display_name_asc_idx
  on public.people(tree_id, display_name asc, id)
  where archived_at is null;

-- 2. Fast parent lookup by parent_id (complementing child_id index)
create index if not exists parent_child_parent_idx
  on public.parent_child_relationships(tree_id, parent_id);

-- 3. Life events chronology index for timeline pagination
create index if not exists life_events_timeline_asc_idx
  on public.life_events(tree_id, occurred_on asc nulls last, id);

-- 4. Global search text pattern matching support
create index if not exists people_display_name_trgm_idx
  on public.people(display_name);

create index if not exists life_events_title_idx
  on public.life_events(tree_id, title)
  where title is not null;

create index if not exists archive_items_title_idx
  on public.archive_items(tree_id, title)
  where state = 'ready';
