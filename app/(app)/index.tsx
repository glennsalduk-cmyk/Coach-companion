import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { getErrorMessage } from '@/lib/errors';
import type { VideoCall } from '@/lib/database.types';

interface IncomingCall {
  id: string;
  peerName: string;
  startedByMe: boolean;
}

export default function Home() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const isCoach = profile?.role === 'coach';

  const [call, setCall] = useState<IncomingCall | null>(null);

  const resolveCall = useCallback(
    async (row: VideoCall) => {
      if (!profile) return;
      if (row.coach_id !== profile.id && row.client_id !== profile.id) return; // défense en profondeur (RLS filtre déjà côté serveur)
      if (row.status !== 'ringing' && row.status !== 'active') {
        setCall((prev) => (prev?.id === row.id ? null : prev));
        return;
      }
      const peerId = row.coach_id === profile.id ? row.client_id : row.coach_id;
      const { data: peerProfile } = await supabase.from('profiles').select('full_name').eq('id', peerId).maybeSingle();
      setCall({ id: row.id, peerName: peerProfile?.full_name || 'Appel', startedByMe: row.started_by === profile.id });
    },
    [profile]
  );

  useEffect(() => {
    if (!profile) return;
    // Chargement initial : un appel déjà en cours (ringing/active) à l'arrivée sur l'écran.
    supabase
      .from('video_calls')
      .select('*')
      .or(`coach_id.eq.${profile.id},client_id.eq.${profile.id}`)
      .in('status', ['ringing', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) void resolveCall(data as VideoCall);
      });

    const channel = supabase
      .channel('home-video-calls')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'video_calls' },
        (payload) => {
          const row = (payload.new ?? payload.old) as VideoCall | undefined;
          if (row) void resolveCall(row);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile, resolveCall]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [programCount, setProgramCount] = useState<number | null>(null);
  const [assignedProgramCount, setAssignedProgramCount] = useState<number | null>(null);
  const [lastSessionAt, setLastSessionAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      if (isCoach) {
        const [{ count: clients, error: clientsError }, { count: programs, error: programsError }] =
          await Promise.all([
            supabase
              .from('coach_clients')
              .select('*', { count: 'exact', head: true })
              .eq('coach_id', profile.id)
              .eq('status', 'active'),
            supabase
              .from('programs')
              .select('*', { count: 'exact', head: true })
              .eq('coach_id', profile.id),
          ]);
        if (clientsError) throw clientsError;
        if (programsError) throw programsError;
        setClientCount(clients ?? 0);
        setProgramCount(programs ?? 0);
      } else {
        const [{ count: assigned, error: assignedError }, { data: lastSession, error: sessionError }] =
          await Promise.all([
            supabase
              .from('program_assignments')
              .select('*', { count: 'exact', head: true })
              .eq('client_id', profile.id),
            supabase
              .from('workout_sessions')
              .select('performed_at')
              .eq('client_id', profile.id)
              .order('performed_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
        if (assignedError) throw assignedError;
        if (sessionError) throw sessionError;
        setAssignedProgramCount(assigned ?? 0);
        setLastSessionAt(lastSession?.performed_at ?? null);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Erreur inattendue.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, isCoach]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.ink }}>
          Bonjour, {profile?.full_name || (isCoach ? 'coach' : 'coaché')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.inkFaint, marginTop: 4, marginBottom: spacing.xl }}>
          {isCoach ? 'Vue coach' : 'Vue coaché'}
        </Text>

        {call && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: colors.tealSoft,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.teal, fontSize: 13.5 }}>
                {call.startedByMe ? 'Appel en attente' : 'Appel entrant'}
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.inkFaint, marginTop: 2 }}>Visio avec {call.peerName}</Text>
            </View>
            <Pressable
              onPress={() => router.push(`/calls/${call.id}`)}
              style={{
                backgroundColor: colors.teal,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 12.5 }}>Rejoindre</Text>
            </Pressable>
            {!call.startedByMe && (
              <Pressable
                onPress={async () => {
                  await supabase.from('video_calls').update({ status: 'declined' }).eq('id', call.id);
                  setCall(null);
                }}
              >
                <Text style={{ color: colors.inkFaint, fontSize: 12.5, fontWeight: '600' }}>Ignorer</Text>
              </Pressable>
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <Text style={{ color: colors.coral, fontSize: 13 }}>{error}</Text>
        ) : isCoach ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatCard label="Clients actifs" value={clientCount ?? 0} bg={colors.primarySoft} color={colors.primary} />
            <StatCard label="Programmes" value={programCount ?? 0} bg={colors.tealSoft} color={colors.teal} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatCard
              label="Programmes attribués"
              value={assignedProgramCount ?? 0}
              bg={colors.primarySoft}
              color={colors.primary}
            />
            <StatCard
              label="Dernière séance"
              value={lastSessionAt ? new Date(lastSessionAt).toLocaleDateString('fr-FR') : '—'}
              bg={colors.coralSoft}
              color={colors.coral}
            />
          </View>
        )}

        <Text onPress={() => void signOut()} style={{ color: colors.inkFaint, fontSize: 12.5, marginTop: spacing.xl }}>
          Se déconnecter
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, bg, color }: { label: string; value: number | string; bg: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.lg, padding: spacing.lg }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{label}</Text>
      <Text style={{ fontSize: 26, fontWeight: '700', color, marginTop: 4 }}>{value}</Text>
    </View>
  );
}
