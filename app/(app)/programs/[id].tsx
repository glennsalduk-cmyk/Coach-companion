import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/lib/theme';
import { ErrorText, FieldLabel, PrimaryButton, TextField } from '@/components/ui';
import type { Exercise, Program, ProgramExerciseWithDetails } from '@/lib/database.types';

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const isCoach = profile?.role === 'coach';

  const [program, setProgram] = useState<Program | null>(null);
  const [items, setItems] = useState<ProgramExerciseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    const [{ data: programData, error: programError }, { data: itemsData, error: itemsError }] =
      await Promise.all([
        supabase.from('programs').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('program_exercises')
          .select('*, exercise:exercises(*)')
          .eq('program_id', id)
          .order('position', { ascending: true }),
      ]);
    if (programError) setError(programError.message);
    else setProgram(programData as Program | null);
    if (itemsError) setError(itemsError.message);
    else setItems((itemsData ?? []) as unknown as ProgramExerciseWithDetails[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleSearchExercises(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', `%${text.trim()}%`)
      .limit(10);
    setResults((data ?? []) as Exercise[]);
    setSearching(false);
  }

  async function handleAddExercise(exercise: Exercise) {
    if (!id) return;
    setAddError(null);
    const { error: insertError } = await supabase.from('program_exercises').insert({
      program_id: id,
      exercise_id: exercise.id,
      position: items.length,
      sets: '3',
      reps: '10',
      rest_seconds: 90,
    });
    if (insertError) {
      setAddError(insertError.message);
      return;
    }
    setQuery('');
    setResults([]);
    setShowAddExercise(false);
    void load();
  }

  async function handleRemoveExercise(programExerciseId: string) {
    await supabase.from('program_exercises').delete().eq('id', programExerciseId);
    void load();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const a = items[index];
    const b = items[targetIndex];
    await Promise.all([
      supabase.from('program_exercises').update({ position: b.position }).eq('id', a.id),
      supabase.from('program_exercises').update({ position: a.position }).eq('id', b.id),
    ]);
    void load();
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

        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: spacing.xl }}>
          {program?.name ?? 'Programme'}
        </Text>

        {error && <ErrorText>{error}</ErrorText>}

        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          {items.length === 0 && (
            <Text style={{ color: colors.inkFaint, fontSize: 13 }}>Aucun exercice pour l’instant.</Text>
          )}
          {items.map((item, index) => (
            <View
              key={item.id}
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
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 13.5 }}>
                  {item.exercise?.name}
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.inkFaint, marginTop: 2 }}>
                  {item.sets} séries × {item.reps} reps
                  {item.rest_seconds ? ` · repos ${item.rest_seconds}s` : ''}
                </Text>
              </View>
              {isCoach && (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable onPress={() => handleMove(index, -1)} disabled={index === 0}>
                    <Text style={{ opacity: index === 0 ? 0.3 : 1, fontSize: 16 }}>↑</Text>
                  </Pressable>
                  <Pressable onPress={() => handleMove(index, 1)} disabled={index === items.length - 1}>
                    <Text style={{ opacity: index === items.length - 1 ? 0.3 : 1, fontSize: 16 }}>↓</Text>
                  </Pressable>
                  <Pressable onPress={() => handleRemoveExercise(item.id)}>
                    <Text style={{ color: colors.coral, fontSize: 16 }}>✕</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>

        {isCoach && (
          <View>
            {showAddExercise ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                }}
              >
                <FieldLabel>Chercher un exercice</FieldLabel>
                <TextField value={query} onChangeText={handleSearchExercises} placeholder="ex. développé couché" />
                <ErrorText>{addError}</ErrorText>
                {searching && <ActivityIndicator color={colors.primary} />}
                <View style={{ gap: spacing.sm }}>
                  {results.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => handleAddExercise(r)}
                      style={{
                        padding: spacing.md,
                        borderRadius: radius.sm,
                        backgroundColor: colors.bg,
                      }}
                    >
                      <Text style={{ fontWeight: '600', fontSize: 13 }}>{r.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.inkFaint }}>
                        {r.muscle_group} · {r.equipment}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowAddExercise(true)}
                style={{
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '700', color: colors.inkSoft, fontSize: 13 }}>+ Ajouter un exercice</Text>
              </Pressable>
            )}
          </View>
        )}

        {!isCoach && items.length > 0 && (
          <PrimaryButton
            label="Démarrer une séance"
            onPress={() => router.push(`/programs/${id}/log`)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
