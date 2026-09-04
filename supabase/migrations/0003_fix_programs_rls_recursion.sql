-- ============================================================================
-- Correctif : récursion infinie entre les policies SELECT de `programs` et
-- `program_assignments`.
--
-- `programs_select_related` fait un EXISTS sur `program_assignments`, et
-- `program_assignments_select_related` fait un EXISTS sur `programs` en
-- retour. Chaque table étant elle-même protégée par RLS, Postgres doit
-- réécrire la sous-requête EXISTS en y appliquant les policies de la table
-- visée — ce qui rouvre l'autre policy, qui rouvre la première, etc. Postgres
-- détecte le cycle et échoue avec l'erreur 42P17 "infinite recursion detected
-- in policy for relation ...". Constaté en conditions réelles (compte coach
-- authentifié consultant l'accueil), pas seulement en théorie.
--
-- Correctif : une fonction SECURITY DEFINER contourne volontairement la RLS
-- de la table qu'elle interroge en interne, donc son appel depuis la policy
-- de l'autre table ne déclenche pas de réécriture récursive — le cycle est
-- rompu sans changer la sémantique d'autorisation (toujours : le coaché peut
-- voir un programme qui lui est attribué, le coach peut voir l'attribution
-- d'un programme qui lui appartient).
-- ============================================================================

create or replace function public.is_program_assigned_to(p_program_id uuid, p_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.program_assignments pa
    where pa.program_id = p_program_id and pa.client_id = p_client_id
  );
$$;

comment on function public.is_program_assigned_to is
  'SECURITY DEFINER : contourne la RLS de program_assignments pour casser la récursion avec la policy select de programs.';

revoke all on function public.is_program_assigned_to(uuid, uuid) from public;
grant execute on function public.is_program_assigned_to(uuid, uuid) to authenticated;

create or replace function public.is_program_owned_by_coach(p_program_id uuid, p_coach_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.programs p
    where p.id = p_program_id and p.coach_id = p_coach_id
  );
$$;

comment on function public.is_program_owned_by_coach is
  'SECURITY DEFINER : contourne la RLS de programs pour casser la récursion avec la policy select de program_assignments.';

revoke all on function public.is_program_owned_by_coach(uuid, uuid) from public;
grant execute on function public.is_program_owned_by_coach(uuid, uuid) to authenticated;

drop policy if exists programs_select_related on public.programs;
create policy programs_select_related on public.programs
  for select using (
    coach_id = auth.uid()
    or public.is_program_assigned_to(id, auth.uid())
  );

drop policy if exists program_assignments_select_related on public.program_assignments;
create policy program_assignments_select_related on public.program_assignments
  for select using (
    client_id = auth.uid()
    or public.is_program_owned_by_coach(program_id, auth.uid())
  );
