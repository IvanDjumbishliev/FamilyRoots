import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function reply(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (request.method !== 'POST')
    return reply(405, { error: 'Method not supported.' });
  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return reply(401, { error: 'Sign in to send an invitation.' });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !publicKey || !serverKey)
      return reply(503, { error: 'Invitations are unavailable.' });
    const auth = { persistSession: false, autoRefreshToken: false };
    const caller = createClient(url, publicKey, {
      auth,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authorizationError,
    } = await caller.auth.getUser(token);
    if (authorizationError || !user)
      return reply(401, { error: 'Sign in to send an invitation.' });

    const reader = request.body?.getReader();
    const decoder = new TextDecoder();
    let body = '',
      bytes = 0;
    if (!reader) return reply(400, { error: 'Invalid invitation.' });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2000) {
        await reader.cancel();
        return reply(413, { error: 'Invitation details are too large.' });
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    let values: {
      tree?: unknown;
      email?: unknown;
      role?: unknown;
      consent?: unknown;
    };
    try {
      values = JSON.parse(body);
    } catch {
      return reply(400, { error: 'Invalid invitation.' });
    }
    if (
      !values ||
      typeof values.tree !== 'string' ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(values.tree) ||
      typeof values.email !== 'string' ||
      values.consent !== true ||
      (values.role !== 'editor' && values.role !== 'viewer')
    ) {
      return reply(400, { error: 'Choose a tree, email address, and role.' });
    }
    const { data, error } = await caller.rpc('request_tree_invitation', {
      p_tree: values.tree,
      p_email: values.email,
      p_role: values.role,
      p_consent: values.consent,
    });
    if (error?.code === '42501')
      return reply(403, { error: 'Only the tree owner can invite members.' });
    if (error?.code === '23505')
      return reply(409, { error: 'This person already belongs to the tree.' });
    if (error?.code === 'P0001')
      return reply(429, {
        error:
          'The invitation limit or resend interval has been reached. Try again later.',
      });
    if (error)
      return reply(400, { error: 'Check the email address and try again.' });

    const invitation = data as { id: string; email: string; attempt: string };
    const sender = Deno.env.get('COLLAB_EMAIL_FROM');
    const providerKey = Deno.env.get('COLLAB_RESEND_API_KEY');
    const app = Deno.env.get('COLLAB_APP_URL');
    if (!sender || !providerKey || !app)
      return reply(200, { id: invitation.id, delivered: false });
    try {
      const link = new URL('/invitations', app);
      if (
        link.protocol !== 'https:' &&
        !(
          link.protocol === 'http:' &&
          ['127.0.0.1', 'localhost'].includes(link.hostname)
        )
      ) {
        return reply(200, { id: invitation.id, delivered: false });
      }
      const provider =
        Deno.env.get('COLLAB_EMAIL_API_URL') ?? 'https://api.resend.com/emails';
      const delivery = await fetch(provider, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${providerKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `familyroots-invite/${invitation.attempt}`,
        },
        body: JSON.stringify({
          from: sender,
          to: [invitation.email],
          subject: 'You have a FamilyRoots AI invitation',
          text: `You were invited to collaborate on a private family tree. Open ${link.href} and sign in or register using the email address that received this message. In a FamilyRoots native build, open familyroots://invitations. Invitations expire in seven days. You can ignore this email if you were not expecting it.`,
        }),
      });
      if (!delivery.ok)
        return reply(200, { id: invitation.id, delivered: false });
      const service = createClient(url, serverKey, { auth });
      const result = await service.rpc('record_invitation_delivery', {
        p_id: invitation.id,
        p_attempt: invitation.attempt,
      });
      return reply(200, {
        id: invitation.id,
        delivered: true,
        trackingPending: Boolean(result.error),
      });
    } catch {
      return reply(200, { id: invitation.id, delivered: false });
    }
  } catch {
    return reply(503, { error: 'Invitations are unavailable. Try again.' });
  }
});
