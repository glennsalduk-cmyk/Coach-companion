import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { ErrorText, PrimaryButton } from '@/components/ui';
import type { CoachClient, Profile } from '@/lib/database.types';

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [client, setClient] = useState<Profile | null>(null);
  const [relation, setRelation] = useState<CoachClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingCall, setStartingCall] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setError(null);
    const [{ data: clientData, error: clientError }, { data: relationData, error: relationError }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('coach_clients')
          .select('*')
          .eq('coach_id', profile.id)
          .eq('client_id', id)
          .maybeSingle(),
      ]);
    if (clientError) setError(clientError.message);
    else setClient(clientData as Profile | null);
    if (relationError) setError(relationError.message);
    else setRelation(relationData as CoachClient | null);
    setLoading(false);
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleStartCall() {
    if (!id || !profile) return;
    setError(null);
    setStartingCall(true);
    const roomName = Crypto.randomUUID();
    const { data, error: insertError } = await supabase
      .from('video_calls')
      .insert({ coach_id: profile.id, client_id: id, room_name: roomName, started_by: profile.id })
      .select()
      .single();
    setStartingCall(false);
    if (insertError || !data) {
      setError(insertError?.message ?? 'Impossible de démarrer l’appel.');
      return;
    }
    router.push(`/calls/${data.id}`);
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 60 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.inkFaint, fontSize: 13 }}>← Retour</Text>
        </Pressable>

        {error && <ErrorText>{error}</ErrorText>}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 18, color: colors.primary }}>
              {(client?.full_name || '?').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>{client?.full_name}</Text>
            <Text style={{ fontSize: 12, color: colors.inkFaint, marginTop: 2 }}>
              {relation?.status === 'active' ? 'Actif' : 'Inactif'}
              {client?.phone ? ` · ${client.phone}` : ''}
            </Text>
          </View>
        </View>

        <PrimaryButton label="Démarrer un appel vidéo" onPress={handleStartCall} loading={startingCall} />
      </ScrollView>
    </SafeAreaView>
  );
}
