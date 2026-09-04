import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { ErrorText, FieldLabel, PrimaryButton, ScreenTitle, TextField } from '@/components/ui';
import type { CoachClient, Profile } from '@/lib/database.types';

interface ClientRow extends CoachClient {
  client: Profile;
}

export default function Clients() {
  const { profile } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('coach_clients')
      .select('*, client:profiles!coach_clients_client_id_fkey(*)')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setClients((data ?? []) as unknown as ClientRow[]);
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleAddClient() {
    setAddError(null);
    if (!email.trim()) {
      setAddError('Renseigne l’email de ton coaché.');
      return;
    }
    setAdding(true);
    const { error: rpcError } = await supabase.rpc('add_client_by_email', {
      client_email: email.trim(),
    });
    setAdding(false);
    if (rpcError) {
      setAddError(rpcError.message);
      return;
    }
    setEmail('');
    setShowAddForm(false);
    void load();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.xl, paddingTop: 60, paddingBottom: spacing.md }}>
        <ScreenTitle>Clients</ScreenTitle>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={{ color: colors.coral, paddingHorizontal: spacing.xl }}>{error}</Text>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(row) => row.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md }}
          ListEmptyComponent={
            <Text style={{ color: colors.inkFaint, fontSize: 13 }}>
              Aucun coaché rattaché pour l’instant.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/clients/${item.client_id}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontWeight: '700', color: colors.primary }}>
                  {(item.client?.full_name || '?').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{item.client?.full_name}</Text>
                <Text style={{ fontSize: 11.5, color: colors.inkFaint, marginTop: 2 }}>
                  {item.status === 'active' ? 'Actif' : 'Inactif'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <View style={{ padding: spacing.xl, paddingTop: 0 }}>
        {showAddForm ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
            }}
          >
            <FieldLabel>Email du coaché (déjà inscrit)</FieldLabel>
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="coache@exemple.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <ErrorText>{addError}</ErrorText>
            <PrimaryButton label="Rattacher ce coaché" onPress={handleAddClient} loading={adding} />
          </View>
        ) : (
          <Pressable
            onPress={() => setShowAddForm(true)}
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '700', color: colors.inkSoft, fontSize: 13 }}>
              + Ajouter un coaché
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
