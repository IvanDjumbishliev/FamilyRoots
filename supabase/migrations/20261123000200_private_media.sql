insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media', 'family-media', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
        'text/plain', 'audio/mpeg', 'audio/mp4', 'video/mp4']
);

create function familyroots_private.media_tree_id(object_name text)
returns uuid language sql immutable strict set search_path = '' as $$
  select case
    when object_name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;
revoke all on function familyroots_private.media_tree_id(text) from public, anon, authenticated;
grant execute on function familyroots_private.media_tree_id(text) to authenticated;

create policy family_media_read_members on storage.objects for select to authenticated
  using (bucket_id = 'family-media' and familyroots_private.current_tree_role(familyroots_private.media_tree_id(name)) is not null);

create policy family_media_add_editors on storage.objects for insert to authenticated
  with check (bucket_id = 'family-media' and familyroots_private.current_tree_role(familyroots_private.media_tree_id(name)) in ('owner', 'editor'));

create policy family_media_delete_editors on storage.objects for delete to authenticated
  using (bucket_id = 'family-media' and familyroots_private.current_tree_role(familyroots_private.media_tree_id(name)) in ('owner', 'editor'));
