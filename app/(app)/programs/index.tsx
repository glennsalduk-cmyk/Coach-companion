import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { ErrorText, FieldLabel, PrimaryButton, ScreenTitle, TextField } from '@/components/ui';
import type { Program } from '@/lib/database.types';

export default function Programs() {
  const { profile } = useAuth();
  const router = useRouter();
  const isCoach = profile?.role === 'coach';

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    let query;
    if (isCoach) {
      query = supabase.from('programs').select('*').eq('coach_id', profile.id).order('created_at', { ascending: false });
    } else {
      // RLS limite déjà program_assignments et programs aux lignes du coaché ;
      // on passe par la table de jointure pour ne récupérer que les programmes attribués.
      query = supabase
        .from('program_assignments')
        .select('program:programs(*)')
        .eq('client_id', profile.id)
        .order('assigned_at', { ascending: false });
    }
    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
    } else if (isCoach) {
      setPrograms((data ?? []) as Program[]);
    } else {
      const rows = (data ?? []) as unknown as { program: Program }[];
      setPrograms(rows.map((r) => r.program).filter(Boolean));
    }
    setLoading(false);
  }, [profile, isCoach]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleCreate() {
    setCreateError(null);
    if (!name.trim() || !profile) {
      setCreateError('Donne un nom à ce programme.');
      return;
    }
    setCreating(true);
    const { data, error: insertError } = await supabase
      .from('programs')
      .insert({ coach_id: profile.id, name: name.trim() })
      .select()
      .single();
    setCreating(false);
    if (insertError) {
      setCreateError(insertError.message);
      return;
    }
    setName('');
    setShowCreate(false);
    void load();
    if (data) router.push(`/programs/${data.id}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.xl, paddingTop: 60, paddingBottom: spacing.md }}>
        <ScreenTitle>Programmes</ScreenTitle>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={{ color: colors.coral, paddingHorizontal: spacing.xl }}>{error}</Text>
      ) : (
        <FlatList
          data={programs}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md }}
          ListEmptyComponent={
            <Text style={{ color: colors.inkFaint, fontSize: 13 }}>
              {isCoach ? 'Aucun programme créé pour l’instant.' : 'Aucun programme attribué pour l’instant.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/programs/${item.id}`)}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 14.5 }}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}

      {isCoach && (
        <View style={{ padding: spacing.xl, paddingTop: 0 }}>
          {showCreate ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              <FieldLabel>Nom du programme</FieldLabel>
              <TextField value={name} onChangeText={setName} placeholder="ex. PUSH Semaine 1" />
              <ErrorText>{createError}</ErrorText>
              <PrimaryButton label="Créer" onPress={handleCreate} loading={creating} />
            </View>
          ) : (
            <Pressable
              onPress={() => setShowCreate(true)}
              style={{
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: colors.inkSoft, fontSize: 13 }}>+ Nouveau programme</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
