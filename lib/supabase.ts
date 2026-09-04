import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Les clés viennent des variables d'environnement EXPO_PUBLIC_* (voir .env.example).
// EXPO_PUBLIC_SUPABASE_ANON_KEY est la clé publique "anon" — sûre à embarquer dans
// l'app côté client, la sécurité réelle est assurée par les policies RLS définies
// dans supabase/migrations/0001_init_schema.sql.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  // On ne fait pas planter l'app au démarrage : on log clairement pour que
  // l'écran de connexion affiche une erreur explicite plutôt qu'un crash muet.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY manquants — ' +
      'copie .env.example vers .env et renseigne les clés de ton projet Supabase.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
