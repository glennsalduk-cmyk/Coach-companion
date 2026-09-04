-- ============================================================================
-- Coach Companion — schéma initial (Phase 1)
-- Auth, profils (coach / coaché), équipes de coachs, relation coach-coaché,
-- bibliothèque d'exercices, programmes, séances loggées.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- Types
-- ============================================================================

create type public.app_role as enum ('coach', 'coache');
create type public.team_member_role as enum ('admin', 'coach', 'assistant');
create type public.client_status as enum ('active', 'inactive');
create type public.exercise_level as enum ('debutant', 'intermediaire', 'avance');
create type public.session_feeling as enum ('facile', 'normal', 'difficile');

-- ============================================================================
-- Tables
-- ============================================================================

-- Un profil par utilisateur authentifié (coach ou coaché). Créé explicitement
-- par l'app après inscription + choix du rôle (pas de trigger auto sur
-- auth.users : le rôle n'est pas connu au moment de la création du compte).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  full_name text not null default '',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Un profil par utilisateur : coach ou coaché.';

-- Un collectif de coachs (indépendants regroupés), facultatif : un coach seul
-- n'a pas besoin d'équipe.
create table public.coach_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.coach_teams is 'Petit collectif de coachs indépendants (facultatif).';

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.coach_teams (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_member_role not null default 'coach',
  created_at timestamptz not null default now(),
  unique (team_id, coach_id)
);

-- Relation coach ↔ coaché. Un coaché peut en théorie avoir plusieurs coachs
-- dans le temps (changement de coach), donc pas de unicité sur client_id seul.
create table public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  status public.client_status not null default 'active',
  started_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (coach_id, client_id)
);

-- Bibliothèque d'exercices, partagée entre tous les utilisateurs authentifiés.
-- created_by = null pour les exercices "système" (seedés), sinon l'exercice
-- personnalisé d'un coach.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  name text not null,
  muscle_group text not null,
  equipment text not null,
  level public.exercise_level not null default 'intermediaire',
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  sets text,
  reps text,
  tempo text,
  rpe text,
  rest_seconds integer,
  created_at timestamptz not null default now()
);

-- Attribution d'un programme à un coaché. Pas d'unicité stricte : un même
-- programme peut être réattribué plusieurs fois dans le temps (historique).
create table public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now()
);

-- Une séance loggée par le coaché (liée ou non à un programme attribué).
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  performed_at timestamptz not null default now(),
  feeling public.session_feeling,
  created_at timestamptz not null default now()
);

-- Détail série par série d'une séance : poids, reps, RPE, complétée ou non.
create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_number integer not null,
  weight_kg numeric(6, 2),
  reps_done integer,
  rpe numeric(3, 1),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Index (colonnes utilisées dans les jointures RLS et les requêtes fréquentes)
-- ============================================================================

create index coach_teams_owner_id_idx on public.coach_teams (owner_id);
create index team_members_team_id_idx on public.team_members (team_id);
create index team_members_coach_id_idx on public.team_members (coach_id);
create index coach_clients_coach_id_idx on public.coach_clients (coach_id);
create index coach_clients_client_id_idx on public.coach_clients (client_id);
create index exercises_created_by_idx on public.exercises (created_by);
create index programs_coach_id_idx on public.programs (coach_id);
create index program_exercises_program_id_idx on public.program_exercises (program_id);
create index program_exercises_exercise_id_idx on public.program_exercises (exercise_id);
create index program_assignments_program_id_idx on public.program_assignments (program_id);
create index program_assignments_client_id_idx on public.program_assignments (client_id);
create index workout_sessions_client_id_idx on public.workout_sessions (client_id);
create index workout_sessions_program_id_idx on public.workout_sessions (program_id);
create index session_sets_session_id_idx on public.session_sets (session_id);
create index session_sets_exercise_id_idx on public.session_sets (exercise_id);

-- ============================================================================
-- updated_at automatique
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.coach_teams enable row level security;
alter table public.team_members enable row level security;
alter table public.coach_clients enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_exercises enable row level security;
alter table public.program_assignments enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_sets enable row level security;

-- --- profiles ---------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_as_coach on public.profiles
  for select using (
    exists (
      select 1 from public.coach_clients cc
      where cc.client_id = profiles.id and cc.coach_id = auth.uid()
    )
  );

create policy profiles_select_as_client on public.profiles
  for select using (
    exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = profiles.id and cc.client_id = auth.uid()
    )
  );

create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- --- coach_teams -------------------------------------------------------------

create policy coach_teams_select_member on public.coach_teams
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = coach_teams.id and tm.coach_id = auth.uid()
    )
  );

create policy coach_teams_insert_owner on public.coach_teams
  for insert with check (owner_id = auth.uid());

create policy coach_teams_update_owner on public.coach_teams
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy coach_teams_delete_owner on public.coach_teams
  for delete using (owner_id = auth.uid());

-- --- team_members ------------------------------------------------------------

create policy team_members_select_member on public.team_members
  for select using (
    coach_id = auth.uid()
    or exists (
      select 1 from public.coach_teams ct
      where ct.id = team_members.team_id and ct.owner_id = auth.uid()
    )
  );

create policy team_members_insert_owner on public.team_members
  for insert with check (
    exists (
      select 1 from public.coach_teams ct
      where ct.id = team_members.team_id and ct.owner_id = auth.uid()
    )
  );

create policy team_members_update_owner on public.team_members
  for update using (
    exists (
      select 1 from public.coach_teams ct
      where ct.id = team_members.team_id and ct.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.coach_teams ct
      where ct.id = team_members.team_id and ct.owner_id = auth.uid()
    )
  );

create policy team_members_delete_owner on public.team_members
  for delete using (
    exists (
      select 1 from public.coach_teams ct
      where ct.id = team_members.team_id and ct.owner_id = auth.uid()
    )
  );

-- --- coach_clients -------------------------------------------------------------

create policy coach_clients_select_related on public.coach_clients
  for select using (coach_id = auth.uid() or client_id = auth.uid());

create policy coach_clients_insert_coach on public.coach_clients
  for insert with check (coach_id = auth.uid());

create policy coach_clients_update_coach on public.coach_clients
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy coach_clients_delete_coach on public.coach_clients
  for delete using (coach_id = auth.uid());

-- --- exercises -----------------------------------------------------------------
-- Bibliothèque partagée en lecture ; seul l'auteur peut modifier/supprimer
-- son propre exercice personnalisé (les exercices système ne sont pas
-- éditables depuis l'app).

create policy exercises_select_all on public.exercises
  for select using (auth.uid() is not null);

create policy exercises_insert_own on public.exercises
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

create policy exercises_update_own on public.exercises
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy exercises_delete_own on public.exercises
  for delete using (created_by = auth.uid());

-- --- programs --------------------------------------------------------------------

create policy programs_select_related on public.programs
  for select using (
    coach_id = auth.uid()
    or exists (
      select 1 from public.program_assignments pa
      where pa.program_id = programs.id and pa.client_id = auth.uid()
    )
  );

create policy programs_insert_coach on public.programs
  for insert with check (coach_id = auth.uid());

create policy programs_update_coach on public.programs
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy programs_delete_coach on public.programs
  for delete using (coach_id = auth.uid());

-- --- program_exercises -----------------------------------------------------------

create policy program_exercises_select_related on public.program_exercises
  for select using (
    exists (
      select 1 from public.programs p
      where p.id = program_exercises.program_id
        and (
          p.coach_id = auth.uid()
          or exists (
            select 1 from public.program_assignments pa
            where pa.program_id = p.id and pa.client_id = auth.uid()
          )
        )
    )
  );

create policy program_exercises_insert_coach on public.program_exercises
  for insert with check (
    exists (
      select 1 from public.programs p
      where p.id = program_exercises.program_id and p.coach_id = auth.uid()
    )
  );

create policy program_exercises_update_coach on public.program_exercises
  for update using (
    exists (
      select 1 from public.programs p
      where p.id = program_exercises.program_id and p.coach_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.programs p
      where p.id = program_exercises.program_id and p.coach_id = auth.uid()
    )
  );

create policy program_exercises_delete_coach on public.program_exercises
  for delete using (
    exists (
      select 1 from public.programs p
      where p.id = program_exercises.program_id and p.coach_id = auth.uid()
    )
  );

-- --- program_assignments -----------------------------------------------------------

create policy program_assignments_select_related on public.program_assignments
  for select using (
    client_id = auth.uid()
    or exists (
      select 1 from public.programs p
      where p.id = program_assignments.program_id and p.coach_id = auth.uid()
    )
  );

create policy program_assignments_insert_coach on public.program_assignments
  for insert with check (
    exists (
      select 1 from public.programs p
      where p.id = program_assignments.program_id and p.coach_id = auth.uid()
    )
  );

create policy program_assignments_delete_coach on public.program_assignments
  for delete using (
    exists (
      select 1 from public.programs p
      where p.id = program_assignments.program_id and p.coach_id = auth.uid()
    )
  );

-- --- workout_sessions -----------------------------------------------------------

create policy workout_sessions_select_related on public.workout_sessions
  for select using (
    client_id = auth.uid()
    or exists (
      select 1 from public.coach_clients cc
      where cc.client_id = workout_sessions.client_id and cc.coach_id = auth.uid()
    )
  );

create policy workout_sessions_insert_own on public.workout_sessions
  for insert with check (client_id = auth.uid());

create policy workout_sessions_update_own on public.workout_sessions
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

create policy workout_sessions_delete_own on public.workout_sessions
  for delete using (client_id = auth.uid());

-- --- session_sets -----------------------------------------------------------------

create policy session_sets_select_related on public.session_sets
  for select using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_sets.session_id
        and (
          ws.client_id = auth.uid()
          or exists (
            select 1 from public.coach_clients cc
            where cc.client_id = ws.client_id and cc.coach_id = auth.uid()
          )
        )
    )
  );

create policy session_sets_insert_own on public.session_sets
  for insert with check (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_sets.session_id and ws.client_id = auth.uid()
    )
  );

create policy session_sets_update_own on public.session_sets
  for update using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_sets.session_id and ws.client_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_sets.session_id and ws.client_id = auth.uid()
    )
  );

create policy session_sets_delete_own on public.session_sets
  for delete using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_sets.session_id and ws.client_id = auth.uid()
    )
  );

-- ============================================================================
-- Fonction : un coach rattache un coaché existant à partir de son email
-- ============================================================================
-- profiles ne stocke pas l'email (il vit dans auth.users, non lisible côté
-- client). Cette fonction SECURITY DEFINER fait la résolution email -> user_id
-- de façon étroite : elle ne renvoie jamais d'email ni de liste, seulement un
-- succès/échec de rattachement, et seulement si l'appelant est un coach et la
-- cible un coaché déjà inscrit. Pas de création de compte ici (Phase 1 :
-- le coaché doit s'être déjà inscrit lui-même).
create or replace function public.add_client_by_email(client_email text)
returns public.coach_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := auth.uid();
  v_client_id uuid;
  v_result public.coach_clients;
begin
  if v_coach_id is null then
    raise exception 'Authentification requise.';
  end if;

  if not exists (select 1 from public.profiles where id = v_coach_id and role = 'coach') then
    raise exception 'Seul un compte coach peut ajouter un coaché.';
  end if;

  select u.id into v_client_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(client_email))
    and p.role = 'coache'
  limit 1;

  if v_client_id is null then
    raise exception 'Aucun coaché inscrit avec cet email.';
  end if;

  insert into public.coach_clients (coach_id, client_id)
  values (v_coach_id, v_client_id)
  on conflict (coach_id, client_id) do update set status = 'active'
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.add_client_by_email(text) from public;
grant execute on function public.add_client_by_email(text) to authenticated;
