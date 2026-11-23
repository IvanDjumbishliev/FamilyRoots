import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import {
  boundedBody,
  decodeUpload,
  inspectFile,
  isUuid,
  maxRequest,
  RequestError,
} from './fileValidation.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-archive-tree',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function response(status: number, data: object) {
  return new Response(JSON.stringify(data), { status, headers });
}

function checked(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === '42501')
    throw new RequestError(
      403,
      'You don’t have permission for this archive action.',
    );
  if (error.message === 'Archive storage limit reached')
    throw new RequestError(
      413,
      'This tree has reached its 500 MB archive limit.',
    );
  if (
    error.code === '23503' ||
    error.code === '23514' ||
    error.code === '23502' ||
    error.code === '22P02' ||
    error.code === '22007'
  ) {
    throw new RequestError(
      400,
      'Check the metadata and select people and an event from this tree.',
    );
  }
  throw new RequestError(
    503,
    'The archive is unavailable. You can retry safely.',
  );
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (!['POST', 'DELETE'].includes(request.method))
    return response(405, { error: 'Method not supported.' });

  try {
    const token = request.headers
      .get('Authorization')
      ?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) throw new RequestError(401, 'Sign in to use the archive.');
    const url = Deno.env.get('SUPABASE_URL');
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !publicKey || !serviceKey)
      throw new RequestError(503, 'The archive is not configured.');
    const options = {
      auth: { autoRefreshToken: false, persistSession: false },
    };
    const userClient = createClient(url, publicKey, {
      ...options,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token);
    if (authError || !user)
      throw new RequestError(401, 'Sign in to use the archive.');
    const service = createClient(url, serviceKey, options);
    const storage = service.storage.from('family-archive');

    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id');
      if (!isUuid(id)) throw new RequestError(400, 'Invalid archive item.');
      const { data, error } = await service.rpc('remove_archive_item', {
        p_id: id,
        p_actor: user.id,
      });
      checked(error);
      const paths = data as string[];
      const removed = await storage.remove(paths);
      if (removed.error) {
        const retried = await storage.remove(paths);
        return response(200, {
          removed: true,
          cleanupPending: Boolean(retried.error),
        });
      }
      return response(200, { removed: true, cleanupPending: false });
    }

    const claimedTree = request.headers.get('x-archive-tree');
    if (!isUuid(claimedTree))
      throw new RequestError(400, 'Choose a family tree.');
    const permission = await userClient
      .from('tree_memberships')
      .select('role')
      .eq('tree_id', claimedTree)
      .eq('user_id', user.id)
      .maybeSingle();
    checked(permission.error);
    if (!permission.data || !['owner', 'editor'].includes(permission.data.role))
      throw new RequestError(
        403,
        'You don’t have permission to upload to this tree.',
      );
    const upload = decodeUpload(await boundedBody(request, maxRequest));
    if (upload.treeId !== claimedTree)
      throw new RequestError(400, 'The upload tree does not match.');
    const image = upload.mime.startsWith('image/');
    if (
      !inspectFile(upload.original, upload.mime) ||
      (image &&
        (!inspectFile(upload.preview, 'image/jpeg', 2000) ||
          !inspectFile(upload.thumbnail, 'image/jpeg', 320))) ||
      (!image && (upload.preview.length || upload.thumbnail.length))
    ) {
      throw new RequestError(
        415,
        'The file contents are invalid or the image is too large to process.',
      );
    }
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new Uint8Array(upload.original),
    );
    const hash = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
    const claim = await service.rpc('claim_archive_upload', {
      p_tree: upload.treeId,
      p_actor: user.id,
      p_hash: hash,
      p_file_name: upload.filename,
      p_mime: upload.mime,
      p_size: upload.original.length,
      p_stored_bytes:
        upload.original.length +
        upload.preview.length +
        upload.thumbnail.length,
      p_derivatives: image,
      p_meta: upload.meta,
      p_people: upload.people,
    });
    checked(claim.error);
    const item = claim.data as {
      id: string;
      duplicate?: boolean;
      pending?: boolean;
      objectPath: string;
      previewPath?: string;
      thumbnailPath?: string;
    };
    if (item.duplicate) return response(200, { id: item.id, duplicate: true });
    if (item.pending)
      throw new RequestError(
        409,
        'This file is already uploading. Wait briefly and retry.',
      );

    const files = [
      { path: item.objectPath, bytes: upload.original, type: upload.mime },
    ];
    if (image && item.previewPath && item.thumbnailPath)
      files.push(
        { path: item.previewPath, bytes: upload.preview, type: 'image/jpeg' },
        {
          path: item.thumbnailPath,
          bytes: upload.thumbnail,
          type: 'image/jpeg',
        },
      );
    try {
      for (const file of files) {
        const result = await storage.upload(file.path, file.bytes, {
          contentType: file.type,
          upsert: false,
          cacheControl: '0',
        });
        if (result.error) throw result.error;
      }
      const ready = await service
        .from('archive_items')
        .update({ state: 'ready', updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('state', 'pending')
        .select('id')
        .single();
      if (ready.error) throw ready.error;
      return response(201, { id: item.id, duplicate: false });
    } catch {
      // A response can be lost after commit. Never remove a ready object's bytes.
      const status = await service
        .from('archive_items')
        .select('state')
        .eq('id', item.id)
        .maybeSingle();
      if (status.data?.state === 'ready')
        return response(200, { id: item.id, duplicate: false });
      if (!status.error) {
        await storage.remove(files.map((file) => file.path));
        await service
          .from('archive_items')
          .update({ state: 'failed' })
          .eq('id', item.id)
          .eq('state', 'pending');
      }
      throw new RequestError(
        503,
        'The upload did not finish. You can retry safely.',
      );
    }
  } catch (error) {
    return error instanceof RequestError
      ? response(error.status, { error: error.message })
      : response(503, {
          error: 'The archive is unavailable. You can retry safely.',
        });
  }
});
