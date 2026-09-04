import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

export const livekitUrl =
  process.env.EXPO_PUBLIC_LIVEKIT_URL ?? Constants.expoConfig?.extra?.livekitUrl ?? '';

if (!livekitUrl) {
  console.warn(
    '[livekit] EXPO_PUBLIC_LIVEKIT_URL manquant — copie .env.example vers .env et renseigne ' +
      'l’URL de ton projet LiveKit Cloud.'
  );
}

interface MintTokenResponse {
  token: string;
  roomName: string;
  identity: string;
}

// Demande un token LiveKit de courte durée pour rejoindre la salle de
// `callId`. L'autorisation est entièrement décidée côté serveur par les
// policies RLS de `video_calls` (voir supabase/functions/mint-livekit-token) :
// si l'appelant n'est ni le coach ni le coaché de cet appel, la fonction
// renvoie une erreur avant même de savoir qu'un token a été demandé.
export async function mintLiveKitToken(callId: string): Promise<MintTokenResponse> {
  const { data, error } = await supabase.functions.invoke<MintTokenResponse>('mint-livekit-token', {
    body: { callId },
  });
  if (error) throw error;
  if (!data) throw new Error('Réponse vide du serveur de visio.');
  return data;
}
