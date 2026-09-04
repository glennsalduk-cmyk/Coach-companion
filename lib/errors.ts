// Les erreurs Supabase (PostgrestError, AuthError, FunctionsHttpError...) sont
// de simples objets avec un champ `.message`, pas des instances d'Error — un
// `err instanceof Error ? err.message : fallback` les manque systématiquement
// et masque le vrai message (utile par ex. pour diagnostiquer un problème
// RLS) derrière un message générique. Voir la récursion RLS sur `programs`
// découverte via ce symptôme exact.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}
