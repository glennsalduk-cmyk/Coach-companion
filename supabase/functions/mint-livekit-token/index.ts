// Fonction Edge Supabase : signe un token LiveKit de courte durée pour un appel
// vidéo (video_calls) donné.
//
// L'autorisation ne repose pas sur une logique métier réécrite ici : on relit
// la ligne `video_calls` avec un client Supabase qui porte le JWT de
// l'appelant, donc les policies RLS de `video_calls` (coach_id = auth.uid()
// OU client_id = auth.uid()) décident seules si l'appelant a le droit de
// rejoindre cette salle. Si la ligne ne revient pas, on refuse.
//
// Le secret API LiveKit ne quitte jamais cette fonction — il vit uniquement
// dans les secrets du projet Supabase (`supabase secrets set LIVEKIT_API_KEY=...
// LIVEKIT_API_SECRET=...`), jamais dans l'app ni dans une variable EXPO_PUBLIC_*.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT } from 'npm:jose@5';

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY');
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const TOKEN_TTL_SECONDS = 60 * 60; // 1h : largement plus qu'une séance de coaching.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error('[mint-livekit-token] LIVEKIT_API_KEY / LIVEKIT_API_SECRET manquants côté secrets Supabase.');
    return json({ error: 'Configuration serveur incomplète.' }, 500);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'Configuration Supabase incomplète.' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Authentification requise.' }, 401);
  }

  let callId: string | undefined;
  try {
    const body = await req.json();
    callId = typeof body?.callId === 'string' ? body.callId : undefined;
  } catch {
    // corps absent ou invalide, callId reste undefined
  }
  if (!callId) {
    return json({ error: 'callId manquant.' }, 400);
  }

  // Client scopé au JWT de l'appelant : toute lecture ci-dessous passe par les
  // policies RLS normales, pas de contournement service-role.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return json({ error: 'Session invalide.' }, 401);
  }

  const { data: call, error: callError } = await supabase
    .from('video_calls')
    .select('id, room_name, coach_id, client_id, status')
    .eq('id', callId)
    .maybeSingle();

  if (callError) {
    console.error('[mint-livekit-token] erreur lecture video_calls', callError);
    return json({ error: 'Impossible de vérifier cet appel.' }, 500);
  }
  if (!call) {
    // Ligne introuvable OU RLS a filtré : dans les deux cas, on refuse sans
    // distinguer (ne jamais révéler qu'un id existe mais appartient à autrui).
    return json({ error: 'Appel introuvable.' }, 404);
  }
  if (call.status === 'ended' || call.status === 'declined') {
    return json({ error: 'Cet appel est terminé.' }, 409);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const identity = user.id;
  const displayName = profile?.full_name?.trim() || 'Utilisateur';
  const now = Math.floor(Date.now() / 1000);

  const secretKey = new TextEncoder().encode(LIVEKIT_API_SECRET);
  const token = await new SignJWT({
    video: {
      room: call.room_name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    name: displayName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVEKIT_API_KEY)
    .setSubject(identity)
    .setJti(`${identity}-${now}`)
    .setNotBefore(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(secretKey);

  return json({ token, roomName: call.room_name, identity });
});
