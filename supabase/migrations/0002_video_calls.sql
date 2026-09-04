-- ============================================================================
-- Coach Companion — appels vidéo (visio) entre un coach et son coaché.
-- Le WebRTC réel (signalisation, SFU, TURN) est délégué à LiveKit Cloud ;
-- cette table ne fait que représenter "qui appelle qui, dans quelle salle,
-- avec quel statut" et sert de base d'autorisation pour la fonction Edge
-- qui signe les tokens LiveKit (voir supabase/functions/mint-livekit-token).
-- ============================================================================

create type public.video_call_status as enum ('ringing', 'active', 'ended', 'declined');

create table public.video_calls (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  -- Nom de salle LiveKit : généré côté client (uuid), unique, jamais réutilisé
  -- même si un nouvel appel est démarré entre les deux mêmes personnes.
  room_name text not null unique,
  status public.video_call_status not null default 'ringing',
  started_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

comment on table public.video_calls is
  'Un appel vidéo entre un coach et son coaché. La salle WebRTC elle-même vit chez LiveKit ; cette ligne sert de garde-fou d''autorisation et d''historique.';

create index video_calls_coach_id_idx on public.video_calls (coach_id);
create index video_calls_client_id_idx on public.video_calls (client_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.video_calls enable row level security;

create policy video_calls_select_related on public.video_calls
  for select using (coach_id = auth.uid() or client_id = auth.uid());

-- Seul un coach peut démarrer un appel, et uniquement vers un coaché
-- effectivement rattaché à lui (relation active dans coach_clients).
create policy video_calls_insert_coach on public.video_calls
  for insert with check (
    coach_id = auth.uid()
    and started_by = auth.uid()
    and exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = video_calls.coach_id
        and cc.client_id = video_calls.client_id
        and cc.status = 'active'
    )
  );

-- Les deux parties peuvent faire évoluer le statut (le coaché accepte/décline,
-- l'un ou l'autre raccroche).
create policy video_calls_update_related on public.video_calls
  for update using (coach_id = auth.uid() or client_id = auth.uid())
  with check (coach_id = auth.uid() or client_id = auth.uid());

-- ============================================================================
-- Realtime : le coaché doit voir apparaître un appel entrant sans recharger.
-- ============================================================================

alter publication supabase_realtime add table public.video_calls;
